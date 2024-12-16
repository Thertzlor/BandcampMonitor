<script setup lang="ts">
import type {BandcampInfo} from '@/App.vue';
const {item} =defineProps<{item:BandcampInfo,favd?:boolean,orig?:boolean}>()
const emit = defineEmits<{(e:'fav',id:string,secondary:boolean):any,(e:"del",idPlus:string,secondary:boolean):any}>()
const {url,item_description,amount_paid_fmt,art_url,id,idPlus,amount_paid_usd} = item
</script>
<template>
  <div target="_blank" class="item" :class="{fav:favd}">
    <a :href="url"> {{ id }} ({{ orig?amount_paid_fmt:`$${amount_paid_usd.toFixed(2)}` }})</a>
    <br>
    <span class="spanislav"><button @click.stop.prevent="e=>emit('fav',idPlus,e.shiftKey)" title="Favorite"></button>
      <a target="_blank" :href="art_url?.replace(/_\d+\./,'_0.') ?? (console.log({url,item_description,amount_paid_fmt,art_url,id,idPlus}),'#')"><img :src="art_url" :alt="item_description"></a>
      <button @click.stop.prevent="e=>emit('del',url,e.shiftKey)" title="Exclude"></button></span>
  </div>
</template>

<style scoped>
.list-move,
/* apply transition to moving elements */
.list-enter-active,
.list-leave-active {
  transition: transform 0.35s ease, opacity 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scale(0.01) rotate(180deg);
}

.item:nth-of-type(odd).list-leave-active {
  left: 50%
}

/* ensure leaving items are taken out of layout flow so that moving
   animations can be calculated correctly. */
.list-leave-active {
  position: absolute;
  z-index: -1000;
}

button {
  --bg_color: rgb(163, 31, 48);
  --sign: "-";
  --shad_val: 1px 1px .1em rgba(0, 0, 0, 0.541);
  transition: filter 0.1s linear;
  margin-bottom: 120px;
  position: relative;
  text-align: center;
  border-radius: 50%;
  display: inline-block;
  padding: 1.5em;
  margin: 1em;
  border: none;
  font-weight: bolder;
  cursor: pointer;
  filter: saturate(0.2) drop-shadow(var(--shad_val));
  background: url('../assets/minussed.svg');
  background-repeat: none;
  background-position: center center;
  background-size: contain;
}


button:first-of-type {
  background: url('../assets/plussed.svg');
}

button:last-of-type::before {
  margin-top: -.08em
}

button:hover {
  filter: saturate(1) drop-shadow(var(--shad_val));
}

a {
  color: rgb(255, 255, 255);
  text-decoration: none;
  white-space: normal;
}

a:visited {
  color: rgb(117, 117, 117)
}

a img {
  margin-top: 1em;
  border: 0.2em solid #747474;
  box-shadow: 2px 1px 4px rgba(0, 0, 0, 0.253);
}

.spanislav {
  white-space: nowrap;
}

.spanislav img {
  margin-top: 1em;
}

.fav {
  text-decoration: underline;
}

.item {
  overflow: hidden;
  display: inline-block;
  text-align: center;
  margin: .3em;
  background: #3c3f41;
  padding: 1em;
  border-radius: 1em;
  vertical-align: middle;
  box-shadow: 1px 3px 1em rgb(0, 0, 0);
  max-width: 18vw;
}
</style>