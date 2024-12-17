<script setup lang="ts">
import {ref,computed,reactive,toRefs,onUnmounted, watch} from 'vue';
import Dexie,{type Table, liveQuery} from 'dexie'
import ArubumItem from './components/ArubumItem.vue'

export type BandcampInfo = {
  item_description:string,
  item_type:'a'|'t',url:string,
  utc_date:number,
  item_price:number,
  amount_paid_fmt:string,
  amount_paid:number,
  artist_name:string,
  art_url:string,
  art_id:number,
  amount_paid_usd:number,
  album_title:string,
  id:string,
  idPlus:string,
  noted?:number
  item_price_usd:number,
}

type SettingsObject = {
  priceLimit:number,
  priceMin:number,
  priceThreshold:number,
  overpayThreshold:number,
  refresher:number,
  type:'a'|'t'|''
}

type FilterObject = {
  text:string,
  regex?:boolean,
  caseSensitive?:boolean,
  matchArtist?:boolean,
  matchTitle?:boolean
  name:string,
}

const getDefault =()=>({text:'',matchArtist:true,matchTitle:true,name:''})

const pageSize = 4
const page = ref(0)
const activeFilter = ref<FilterObject>(getDefault())
const exput = ref<string>("")
const settingsActive = ref(false)
const unNotable = ref(new Set<string>())
const blockRefresh = ref(false)
const origCurrency = ref(true)
const addFilterVisible = ref(false)

const db = new (class BandcampDexie extends Dexie {
  exclude!:Table<{id:string,date?:number}>
  favorites!:Table<{id:string,date?:number}>
  filters!:Table<FilterObject>

  constructor(){
    super('bandcamper-db');
    this.version(1).stores({exclude:'id',favorites:'id',filters:'name'});
  }
})()

const queries = reactive({exclude:new Set<string>(),excludeError:null,favorites:[] as string[],filters:[] as FilterObject[]})
const queryRefs = toRefs(queries)

const excludeSubscription = liveQuery(()=>db.exclude.toArray()).subscribe(items => queryRefs.exclude.value = new Set(items.sort((a,b) => (a.date??0)>(b.date??0)?1:-1).map(m=>m.id)))
const favoriteSubscription = liveQuery(()=>db.favorites.toArray()).subscribe(items => queryRefs.favorites.value = items.sort((a,b) => (a.date??0)>(b.date??0)?1:-1).map(m=>m.id))
const filterSubscription = liveQuery(()=>db.filters.toArray()).subscribe(items => queryRefs.filters.value = items)

onUnmounted(()=>{
  excludeSubscription.unsubscribe()
  favoriteSubscription.unsubscribe()
  filterSubscription.unsubscribe()
})

const stored = localStorage.getItem('bcd')
const storedVal:SettingsObject|undefined = stored?JSON.parse(stored):undefined
const settings = ref<SettingsObject>({overpayThreshold:10,priceMin:0,priceLimit:999,priceThreshold:0,type:'a',refresher:30,...storedVal})

const editExclude = ref(false)
const editFavorites = ref(false)
const disableExclude = ref(false)
const notable = ref<Record<string,BandcampInfo>>({})


const checkNotability = (i:BandcampInfo) => {
  const {amount_paid_usd,url,item_price_usd} = i
  if(unNotable.value.has(url)) return i
  const overpaid = amount_paid_usd - item_price_usd
  if(amount_paid_usd < settings.value.priceThreshold  || overpaid < settings.value.overpayThreshold) return i
  if(notable.value[url]) notable.value[url].amount_paid_usd = Math.max(amount_paid_usd,notable.value[url].amount_paid_usd)
  else notable.value[url] = i
  return i
}

const matchFilter = (f:FilterObject, b:BandcampInfo) => {
  if(disableExclude.value) return false
  const reg = new RegExp(f.regex?f.text:`\\b${f.text}\\b`,f.caseSensitive?undefined:'i')
  if(f.matchArtist && reg.test(b.artist_name)) return true
  if(f.matchTitle && reg.test(b.item_description)) return true
  return false
}

const unfilteredInfoEntries = ref<BandcampInfo[]>([]);
const saveSettings = () => localStorage.setItem('bcd', JSON.stringify(settings.value))

const refreshSalesData = (async () => {
  try {
    const res = await fetch('https://bandcamp.com/api/salesfeed/1/get?start_date=0');
    const camps = (await res.json() as {events:{items:BandcampInfo[]}[]}).events.flatMap((e)=>e.items.map(e=>{
      e.id = `${e.artist_name} - ${e.item_description}`
      e.idPlus = `${e.id};${e.url}`
      const conversionRate = (e.amount_paid_usd/e.amount_paid)
      e.item_price_usd = e.item_price * conversionRate
      return e;
    }));
    unfilteredInfoEntries.value = camps
    setTimeout(saveSettings,300)
  } catch (err:any) {console.log(err.message);}
});

refreshSalesData()

const deleteFavoritesUpTo = (n:number) => {for (let i = 0; i < n; i++)  db.favorites.delete(queries.favorites[i])}

const importer = (impstr:string) => {
  try{
    const arr:string[]|undefined = JSON.parse(impstr)
    if(!Array.isArray(arr)) throw new Error('No Array')
    db.favorites.clear();
    for (const id of arr) db.favorites.add({id,date:Date.now()})
  }catch(e){console.log(e)}
}

const autoRemove = (i:BandcampInfo,shift=false) => {
  unNotable.value.add(i.url)
  if(!shift) db.exclude.add({id:i.url,date:Date.now()})
  delete (notable.value)[i.url]
}

setInterval(()=>(!blockRefresh.value) && refreshSalesData(),settings.value.refresher * 1000)

const filteredEntries = computed(()=> unfilteredInfoEntries.value.filter(b=>(b.item_price_usd >= settings.value.priceMin) && (b.item_price_usd <= settings.value.priceLimit) &&  (disableExclude.value || !queries.exclude.has(b.url))  && (!settings.value.type || b.item_type === settings.value.type)).filter(b=>queries.filters.every(f => !matchFilter(f,b))))

const notableEntries =computed(()=> Object.entries(notable.value).filter(([k,v]) => !unNotable.value.has(k) && !queries.exclude.has(v.url)).map(([_,v]) => v).filter(b=>queries.filters.every(f => !matchFilter(f,b))))

const shortcutAdd = (ev:KeyboardEvent,fav=false) => {
  if(ev.ctrlKey || ev.altKey) return;
  const pageList = notableEntries.value.sort((a,b) => a.amount_paid_usd>b.amount_paid_usd?-1:1).slice(pageSize*page.value,pageSize*(page.value+1))
  const item = pageList[0];
  if(item){
    if(fav)db.favorites.add({id:item.idPlus,date:Date.now()})
    autoRemove(item, ev.shiftKey)
  }
}

const numPages = computed(()=> Math.ceil(notableEntries.value.length/pageSize))
watch(numPages,()=>page.value = Math.max(Math.min(page.value,numPages.value-1),0))
watch(addFilterVisible,a => !a && (activeFilter.value = getDefault()))
const nPage = () => page.value=Math.min(numPages.value-1,page.value+1)
const pPage = () => page.value = Math.max(0,page.value-1)
const unReact = (x:any) => JSON.parse(JSON.stringify(x))
const sizer = computed(()=>Math.max((100/numPages.value),10))
const positioner = computed(()=> (page.value/(numPages.value-1)) * (100-sizer.value))
</script>

<template>
  <div id="logo"><img src="./assets/bcm_logo.png" alt="bmonitor logo"></div>
  <a v-if="!settingsActive" id="helplink" title="Help/Readme" href="https://github.com/Thertzlor/BandcampMonitor/blob/main/README.md#usage">?</a>
  <div class="form">
    <label title="Show Settings" id="mainOpt">⚙<input type="checkbox" class="inbox" v-model="settingsActive"></label>

    <template v-if="settingsActive">
      <h3>Price Criteria</h3>
      <label>Maximum Base Price <input type="number" v-model="settings.priceLimit"></label>
      <label>Minimum Base Price <input type="number" v-model="settings.priceMin"></label>
      <hr>
      <h3>Notability Criteria</h3>
      <label>Minimum Notable Payment<input type="number" v-model="settings.priceThreshold"></label>
      <label>Minimum Notable Overpayment<input type="number" v-model="settings.overpayThreshold"></label>
      <hr>
      <h3>Display Options</h3>
      <label>
        Release Type
        <select v-model="settings.type">
          <option value="a">Album</option>
          <option value="t">Track</option>
          <option value="">All</option>
        </select>
      </label>
      <label title="Save Settings and reload page for this setting to apply.">Refresh Interval (Seconds)<input type="number" v-model="settings.refresher"></label>
      <label>Show Amounts in {{origCurrency?"Dollars":"Original Currency"}}<input type="checkbox" v-model="origCurrency"></label>
      <label :style="{color:blockRefresh?'rgb(55 147 39)':'rgb(147 39 63)'}">{{blockRefresh?"Resume":"Pause"}} Auto Refresh<input type="checkbox" v-model="blockRefresh"></label>
      <hr>
      <button @click="()=>saveSettings()">Save Settings</button>
      <button @click="()=>refreshSalesData()">Manual Sales Refresh</button>
    </template>

  </div>
  <input class="inbox" type="checkbox" id="fbox" v-model="editFavorites"><label class="top" for="fbox">Favorites [{{ queries.favorites.length }}] {{editFavorites?'⬆':"⬇"}}</label>
  <div v-if="editFavorites" class="listium">
    <button v-if="queries.favorites.length" @click="()=>void db.favorites.clear()">Clear All</button>
    <button id="expbut" @click="()=>{exput=JSON.stringify(queries.favorites)}">Export</button>
    <button id="impbut" :disabled="!exput" @click="() => importer(exput) ">Import</button><br>
    <textarea v-if="exput" v-model="exput"></textarea>
    <ul>
      <li class="flat_entry" v-for="[i,[t,u]] in queries.favorites.map((e,i) => [i,e.split(';') as [string,string]] as const)" :key="i"><button @click="e=> e.shiftKey? deleteFavoritesUpTo(i+1)  : db.favorites.delete(queries.favorites[i])">Remove</button><a :href="u || `https://bandcamp.com/search?q=${t.replace(/[ -&]+/g,'+')}&item_type=a`">{{ t }}</a></li>
    </ul>
  </div>
  <input class="inbox" type="checkbox" id="ebox" v-model="editExclude"><label class="top" for="ebox">Excluded {{editExclude?'⬆':"⬇"}}</label>
  <div class="listium" v-if="editExclude">
    <button v-if="queries.exclude.size" @click="()=> disableExclude = !disableExclude" :style="{background:disableExclude?'red':'green'}" id="exShow">{{disableExclude?'Hide':'Show'}} All</button>
    <h3>Exclusion Filters</h3><input type="checkbox" id="adf" v-model="addFilterVisible"><label for="adf">Add Filter</label>
    <form v-if="addFilterVisible" id="fiForm" @submit.stop.prevent="()=> (db.filters.add(unReact(activeFilter)),(activeFilter = getDefault()))">
      <input required placeholder="Name" type="text" name="txt" v-model="activeFilter.name">
      <input required placeholder="Filter Value" type="text" name="nam" v-model="activeFilter.text">
      <template v-for="t in (['matchTitle','matchArtist','caseSensitive','regex'] as const)" :key="t">
        <input v-model="activeFilter[t]" type="checkbox" name="ckecker" :id="t">
        <label :for="t" class="f_label">{{ t.replace(/([A-Z])/," $1").replace(/^./, m=>m.toUpperCase()) }} </label>
      </template>
      <button type="submit">Save Filter</button>
    </form>
    <ul>
      <li class="flat_entry" v-for="f of queries.filters.values()" :key="f.name"><button @click="()=>db.filters.delete(f.name)">Remove</button><button class="edit" @click="((activeFilter=queries.filters.find(l => l.name == f.name)?? activeFilter),(addFilterVisible=true))">Edit</button>{{ f.name }}</li>
    </ul>
    <h3>Manual Exclusions</h3>
    <button v-if="queries.exclude.size" @click="()=>void db.exclude.clear()">Clear All</button>
    <ul>
      <li class="flat_entry" v-for="[i,e] in queries.exclude.entries()" :key="i"><button @click="()=>db.exclude.delete(e)">Remove</button>{{ e }}</li>
    </ul>
  </div>
  <div :style="{['--scroller_size']:`${sizer}%`,['--scroller_pos']:`${positioner}%`}" tabindex="0" @keydown.left="pPage" @keydown.right="nPage" @keydown.a="e=>shortcutAdd(e,true)" @keydown.s="e=>shortcutAdd(e,false)" class="note">
    <h3>Notable Sales [{{ notableEntries.length }}]</h3> <button class="dbut" @click="pPage">⇦</button><button class="dbut" @click="nPage">⇨</button><br>
    <div :style="{opacity:numPages === 1?0:1}" id="pseudoscroll"></div>
    <TransitionGroup name="list">
      <ArubumItem :orig="origCurrency" v-for=" i of notableEntries.sort((a,b) => a.amount_paid_usd>b.amount_paid_usd?-1:1).slice(pageSize*page,pageSize*(page+1))" :favd="queries.favorites.includes(i.idPlus)" :key="i.utc_date" :item="i" @del="(_,shift) => 
    autoRemove(i,shift)" @fav="id=>db.favorites.add({id,date:Date.now()})" />
    </TransitionGroup>
  </div>
  <div v-for="x of ([0,1] as const)" :key="x" class="cont">
    <h3 v-if="x">Current Sales: Newest</h3>
    <h3 v-else>Current Sales: Highest Paid</h3>
    <TransitionGroup name="list">
      <ArubumItem :orig="origCurrency" v-for="i of filteredEntries.map(m=>checkNotability(m))
      .sort((a,b) => ((c= (['artist_name','utc_date'] as const)[x])=>(a[c] > b[c]?-1:1))())
      .sort((a,b) => x?1:a.amount_paid_usd < b.amount_paid_usd?1:-1)" :key="i.utc_date" :favd="queries.favorites.includes(i.idPlus)" :item="i" @del="id => (db.exclude.add({id,date:Date.now()}))" @fav="id=>db.favorites.add({id,date:Date.now()})" />
    </TransitionGroup>
  </div>
  <footer> <a title="Check out the repo!" href="https://github.com/Thertzlor/BandcampMonitor/"> <img src="./assets/gh.svg" alt="github logo"> </a> </footer>
</template>
<style scoped>
#logo {
  position: absolute;
}

#logo img {
  filter: drop-shadow(2px 4px 10px black);
  max-width: 25vw;
}

.cont h3 {
  display: inline-block;
  width: 100%;
  position: relative;
}

footer {
  text-align: right;
  padding: 1em;
}

footer img {
  filter: drop-shadow(2px 4px 10px black);
  max-height: 2em;
  transition: transform ease-out .1s;
}

footer img:hover {
  transform: scale(1.2);
}

.note h3 {
  text-align: left;
  width: 100%
}

.listium h3:first-of-type {
  margin-top: 0
}

.listium h3:last-of-type {
  margin-bottom: 0
}

.inbox,
#adf {
  display: none
}

.inbox+label {
  display: block;
}

.dbut {
  color: white;
  background: none;
  font-size: 1.5em;
  padding: 0 .3em;
  border-radius: .3em;
  border: darkcyan solid 3px;
  margin: 0 .5em;
  color: darkcyan;
  cursor: pointer;
}

label[for=adf][for=adf] {
  text-decoration: none;
  font-size: 1em;
  font-weight: bold;
}

label.top {
  margin-top: 1em;
  font-weight: bold
}

.dbut:active {
  color: greenyellow
}

#fiForm input[type="text"],
.form input,
.form select {
  background: transparent;
  font-size: .9em;
  padding: .3em;
  border: 3px solid rgb(161, 198, 211);
  border-radius: .5em;
  color: white;
  margin-left: .5em;
}

select option {
  color: black;
}

.form input {
  width: 3em;
}

.form label:not(:first-child) {
  margin: .5em;
}

.form label:last-of-type,
.form label:nth-last-of-type(2) {
  cursor: pointer;
}

.form input[type=checkbox] {
  display: none;
}

#fiForm {
  margin-bottom: 1em;
}

#fiForm label[for],
label[for=adf][for=adf],
#fiForm button,
.form button {
  padding: .3em;
  border: 3px solid rgb(55, 155, 188);
  display: inline-block;
  font-size: .9em;
  text-decoration: none;
  border-radius: .5em;
  margin: 0 .5em;
  cursor: pointer;
}

label[for=adf][for=adf] {
  border-color: rgb(55, 188, 155);
  margin-bottom: 1em
}

#fiForm button {
  text-shadow: none;
  font-family: inherit;
}

#fiForm input:checked+label[for],
:checked+label[for=adf][for=adf] {
  border-color: white;
  background: rgb(55, 155, 188);
  color: black;
  font-weight: bolder;
  text-shadow: none;
}

:checked+label[for=adf][for=adf] {
  background: rgb(55, 188, 155);
}


#pseudoscroll {
  margin: .7em 0;
  position: relative;
  height: .5em;
  width: 100%;
}

#pseudoscroll::after {
  transition: left .2s ease;
  display: inline-block;
  content: "";
  position: absolute;
  height: 100%;
  width: var(--scroller_size);
  opacity: .5;
  border-radius: 2em;
  --shadow_col: rgba(203, 204, 210, 0.514);
  box-shadow: 0 0 6px var(--shadow_col) inset, 0 0 2px var(--shadow_col);
  left: var(--scroller_pos);
}

#fiForm input[type="checkbox"] {
  display: none;
}

#mainOpt {
  user-select: none;
  cursor: pointer;
  line-height: 1;
  text-align: right;
  text-shadow: 0 0 6px black;
}

#mainOpt:hover {
  color: rgb(119, 185, 119)
}

.note {
  white-space: nowrap;
  overflow-x: hidden;
  padding: 0 5vw;
  padding-bottom: 2.5em;
  min-height: 250px;
  text-align: center;
}

.note a {
  display: inline-block;
  margin-right: 1em;
  max-width: 20%;
}

.form button {
  background: none;
  color: white;
  font-weight: bold;
  margin-bottom: .5em
}

.form button:active {
  background: rgb(55, 155, 188);
}


.form,
#helplink {
  position: fixed;
  right: 1em;
  z-index: 100;
  top: 1em;
  padding: .5em;
  border-radius: .5em;
  background: rgb(63 72 81);
  box-shadow: 1px 3px 1em rgb(0, 0, 0);
}

#helplink {
  color: white !important;
  top: 3.5em;
  line-height: 0;
  text-align: center;
  padding: 1em 0.7em;
  display: block;
}

.form label {
  display: block;
  font-weight: bold;
}

.form h3 {
  text-decoration: underline;
  margin-bottom: 0;
  margin-top: 0
}

.form h3:nth-of-type(1) {
  margin-top: -.5em;
}

a {
  color: rgb(255, 255, 255);
  text-decoration: none
}

a:visited {
  color: rgb(102, 102, 102)
}

.cont {
  width: 46%;
  display: inline-block;
  padding: 2%;
  vertical-align: top;
  text-align: center;
}

label[for] {
  text-align: center;
  font-size: 1.4em;
  text-decoration: underline;
}

.listium {
  text-align: center;
}

.flat_entry button:first-of-type {
  margin-left: 0;
}

.listium ul {
  list-style: none;
  width: fit-content;
  margin: 0 auto;
  text-align: left;
  padding: 0;
  max-width: 70%;
}

.listium button {
  user-select: none;
  cursor: pointer;
  display: inline-block;
  margin: 1em .5em;
  padding: 0.2em .4em;
  font-size: .9em;
  color: white;
  font-family: inherit;
  background: red;
  font-weight: bold;
  border-radius: 0.31em;
  border: 3px solid rgb(187, 202, 208);
  filter: saturate(0.3);
}

.listium button.edit {
  margin-left: -.5em;
  background: rgb(79, 107, 228);
}

.listium {
  textarea {
    text-shadow: none;
    width: 50%;
    height: 10em;
  }
}

.listium.listium button:disabled {
  filter: saturate(0.05);
  cursor: default;
}

.listium button:hover {
  filter: none
}

.flat_entry button {
  margin: .2em 1em;
  padding: 0 0.3em;
}
</style>