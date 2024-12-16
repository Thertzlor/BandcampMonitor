# Bandcamp Monitor

![UI example](/src/assets/UI_example.png)
<p align="center"><i>See what's selling...</i></p>

Bandcamp Monitor is a web app that aggregates data from bandcamp music sales and automatically highlights notable items based on user settings.  

For example, you could set up Bandcamp monitor to...
* Keep track of pay-what-you-want albums that sold for more than $10.
* Keep track of tracks or albums with a base price between $5 and $10 that sold for at least $5 more than their base price.
* etc.

The main use case of this app is to act as a "capitalism based" music discovery tool.  
Want to know which of the millions of albums on bandcamp might be worth your time? Seeing what people are throwing their money at right now might be a good start.

## Installation
Simply clone this repository, and after `npm install` either run `npm run dev` to quickly get a local dev server up or `npm run build` to get a the bundled app you can put on your server.

>**Note:** Bandcamp Monitor does not centrally store any data on any servers, it only fetches requests from bandcamp and any favorites, filters and settings are stored locally on your client.

## Usage
The main UI of Bandcamp Monitor consists of three lists. Then top list is the list of *notable* sales based on your filters, ordered by sales price. 4 Items are displayed at once, use the arrow buttons to scroll through the list.

The two *Current Sales* lists at the bottom both display the current state of the live sales ticker. The right list shows entries sorted by price paid, the left shows the list sorted by sale date.

The individual track/album entries can then be added to your favorites list by clicking the green **`+`** button, or to your manual exclusion list by clicking the red **`-`** button. Excluded items are removed from the Current and Notable Sales lists, and will not be listed in the future.  
You can also click any cover image to display the largest version bandcamp has available.

The *Notable* list and both live lists reset when the page is reloaded, but favorites, exclusions and settings are saved for the next session.

### Settings
Clicking the gear button in the top right corner of the app opens the Settings menu, where you can customize Bandcamp Monitor in various ways. Settings can be saved locally.
>**Note:** All price related settings operate on US dollar values, even if the item was originally sold in another currency.

#### Price Criteria
* **Maximum Base Price:** Items above this price will not be listed in the Current *or* Notable sales lists.
* **Minimum Base Price:** Items below this price will not be listed in the Current *or* Notable sales lists.
#### Notability Criteria
* **Minimum Notable Payment:** How much an item needs to sell for to be included in the *Notable Sales* list.
* **Minimum Notable Overpayment:** How much a sale needs to exceed the item's bas price to be included in the *Notable Sales* list. E.g. if you set this field to 5, a $10 dollar album will be included as notable if it has sold for more than $15.
#### Display Options
* **Release Type:** Select if Bandcamp Monitor should list only Tracks, only Albums, or both. 
* **Refresh Interval (Seconds):** Adjust how frequently new information is fetched from the live ticker. *You really should **not** set it under 30 seconds, the stats don't update that often, and bandcamp will reject too frequent requests*
* **Show Amounts in Dollars/Original Currency:** By default sales items will be shown in whatever original currency they were sold. With this option converted dollar amounts are displayed.
* **Pause/Resume Auto Refresh:** This option disables the automatic refresh of sales data. While paused it can still be triggered via the `Manual Sales Refresh` button below.

### The Favorites Section
In the favorites section you can see a list of links of bandcamp links to the albums and tracks you favorited. The `Remove` button next to each link does just what it says it does and the `Clear All` removes all favorites.

>**Note:** If you hold shift while clicking the `Remove` button, all links *up to and including* the targeted link will be removed from the list, starting from the top.
#### Import/Export
The `Export` button will export the contents of your favorites list as a simple JSON array. Each entry is a single sgtring which consists of the Artist name and album/track title and the bandcamp URL separated by a semicolon.

To import a favorites list, simply paste a string array of the same semicolon separated formatting into the text area opened by the `Export` button and click the `Import` button.  
Imports will fully override the current favorites list.

### The Excluded Section
The Excluded section is divided into two lists for general filters and manual exclusions respectively.  
At the top, you can disable all exclusions, which will make all previosuly filtered items reappear.

In the *Exclusion Filters* section, you can add filters for matching titles and/or artists that should always be excluded from the sales lists.  
Filters that do not use Regex always match whole words, if you save a filter with the same name as another filter, the old filter will be overridden.  
Saved filters are shown as a list from which they can be removed and edited.

Finally you can also view the full list of manually excluded URLs (which, if you use tha app for a while, can get pretty huge), from which you can delete individual entries, or use the `Clear All` button to empty the entire list.


### Keyboard Shortcuts
After clicking anywhere within the `Notable Sales` list you can...
* use the `left` and `right` arrow keys to change the current page.  
* press the `a` key to add the first item of the current page to your favorites list.  
This will remove it from the `Notable Sales` list, and the next item will take its spot.
* press the `s` key to add the first item of the current page to your `Exclude` list.  
This will also remove it from the `Notable Sales` list.

>**Note:** If shift is pressed together with `a`/`s`, removed items are *not* added to the `Exclude` list.

## How it works
Bandcamp has, tragically, shut down access to their API. But one glimmer of hope remains in form of the live sales ticker on their homepage which still utilizes a publicly available endpoint and this tool basically tries to make the most of it, without needing to implement an elaborate scraping approach.

This means we have to make do with whatever information the sales ticker provides, which is not much. It does not include any metadata like tags, label, track/album length etc, so these things can't be displayed or filtered. But as a simple general discovery tool it works well enough.

To store the lists of favorites, exclusions and filters locally, the app uses IndexedDB via [Dexie.js](https://github.com/dexie/Dexie.js).

## Roadmap
* Support for frequency based notability (like item sold *x* times within *y* minutes/hours)
* Support for multiple simulatenous notability filters
* individually enabled and disabled filters
* Export/Import for exclusion filters
* Make item sizes in UI more adjustable, maybe.
