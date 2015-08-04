/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// Constants
var DEBUG = true;
var DEBUG_WWW_URL = 'http://localhost/~ghis/momo/www/';
var ANIMATION_ENABLED = true;
var ANIMATION_OUT_CLASS  = 'pt-page-moveToLeftEasing pt-page-ontop';
var ANIMATION_IN_CLASS = 'pt-page-moveFromRight';
var ANIMATION_BACK_OUT_CLASS  = 'pt-page-moveToRightEasing pt-page-ontop';
var ANIMATION_BACK_IN_CLASS = 'pt-page-moveFromLeft';

// Application
var app = {

    // Menu Registry
    menu: [],

    // Pages Registry
    pages: {},

    // Minimal Default Manifest
    manifest: {
        meta: {
            'title': 'Momo Application',
            'contact': 'contact@cadoles.com',
            'updateUrl': 'index.json',
            'updateFreq': 0
        }
    },

    // Misc Data
    current       : 0,
    isAnimating   : false,
    endCurrPage   : false,
    endNextPage   : false,
    hashHistory   : [window.location.hash],
    historyLength : window.history.length,
    rootPath      : '',

    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },

    // Application events
    bindEvents: function() {

        // Navigation Handler
        window.addEventListener('hashchange', this.onHashChange, false);

        // Device Handler
        window.isphone = false;
        if(document.URL.indexOf("http://") === -1 
            && document.URL.indexOf("https://") === -1) {
            window.isphone = true;
        }

        // Phone Context
        if( window.isphone ) { 
            document.addEventListener("deviceready", this.onDeviceReady, false);
        // Testing Context
        } else { 
            this.onDeviceReady();
        }
    },

    // Device ready callback
    onDeviceReady: function() {
        app.initIndex();
        app.loadManifest();
        FastClick.attach(document.body);
    },

    // Initialize search engine index
    initIndex: function(){
        app.index = lunr(function () {
            this.use(lunr.fr);
            this.field('title', {boost: 10})
            this.field('body')
            this.ref('id')
            this.pipeline.add(function (token, tokenIndex, tokens) {
                if(token.length > 2)
                    return app.utils.replaceAccents(token);
            });
        });
    },

    // JSON Manifest loading function
    loadManifest: function(){
        if(DEBUG) console.log('load '+JSON.stringify(app.manifest));
        app.utils.setLoadingMsg("Chargement de l'application");

        var updateRequired = true;

        // In case the url is incorrect, we get the backup manifest
        app.safeManifest = app.manifest;

        // Get manifest from localStorage if it exists
        if(localStorage.getItem("momo-manifest")){
            try {
                app.manifest = JSON.parse(localStorage.getItem("momo-manifest"));
            } catch(e) {}
        }

        // Checklast Update
        var lastUpdate   = localStorage.getItem("momo-timestamp") ? new Date(localStorage.getItem("momo-timestamp")) : new Date(0);
        var timeDiff     = ((new Date()).getTime() - lastUpdate.getTime()) / 1000;
        updateRequired   = timeDiff > app.manifest.meta.updateFreq;

        // Start Application Return if no need for update
        if(!updateRequired && !DEBUG){
            app.start();
            return;
        }

        // Start AJAX
        var url          = app.manifest.meta.updateUrl;
        var request      = new XMLHttpRequest();

        request.open('GET', url, true);

        // AJAX Callback
        request.onload = function() {

            // AJAX success
            if (request.status >= 200 && request.status < 400 || request.status == 0 /* iOS OhMyBuddha!! */) {

                // Patch raw text response for filesystem relative paths
                app.patchResponse(request.responseText, function(manifestResponse){

                    try {
                        // Override current manifest
                        app.manifest = JSON.parse(manifestResponse);

                        // Store manifest if parsable
                        localStorage.setItem("momo-manifest", manifestResponse);
                    } catch(e) {
                        if(DEBUG) console.log('Cannot parse application manifest '+url);
                    }

                    // Reload if new manifest url
                    if(url != app.manifest.meta.updateUrl){
                        app.loadManifest();
                    // Otherwise fetch assets and start application
                    } else if(updateRequired) {
                        app.fetchAssets(function(){
                            app.start();
                        });
                    // Start application with no udpates
                    } else {
                        app.start();
                    }
                });

            // Handle AJAX Error
            } else {
                app.onAjaxError(url, request);
            }
        };

        // Handle AJAX Error
        request.onerror = function() {
            app.onAjaxError(url);
        };

        // Send AJAX
        request.send();
    },

    // Start Application with safe manifest
    onAjaxError: function(url, request){
        if(DEBUG) console.log("Cannot load "+url+" [Error "+(request ? request.status : 'Unknown')+"]. Loading local manifest instead.");

        // Store proper manifest
        localStorage.setItem("momo-manifest", JSON.stringify(app.safeManifest));

        // Restore safe manifest 
        app.manifest = app.safeManifest;

        // And start application
        app.start();
    },

    // Patch manifest response to set filesystem's relative paths (offline)
    patchResponse: function(response, cb){

        // Phone context requires 'FileTransfer' & 'Zip' plugins
        if(typeof FileTransfer !== 'undefined' && typeof zip !== 'undefined'){
            window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, function (fileSystem) {

                // Get filesystem's relative cache folder
                var rootPath = fileSystem.root.toURL();

                // Patch path to local in manifest response
                var manifestResponse = response.replace(/assets\//g, rootPath+'assets/');

                // Callback
                cb(manifestResponse);

            });
        } else {
            var manifestResponse = response.replace(/assets\//g, DEBUG_WWW_URL+'assets/');
            cb(manifestResponse);
        }
    },

    // Get distant zip asset archive and update local cache
    fetchAssets: function(cb){

        if(DEBUG) console.log('fetch assets');
        app.utils.setLoadingMsg("Téléchargement de la mise à jour");

        if(typeof FileTransfer !== 'undefined' && typeof zip !== 'undefined'){
            window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, function (fileSystem) {

                var rootPath = fileSystem.root.toURL();
                var fileTransfer = new FileTransfer();
                var uri = encodeURI(app.manifest.meta.assetsUrl);
                var filePath = fileSystem.root.toURL() + uri.substr(uri.lastIndexOf("/") + 1);
                
                // Fetch Assets Zip Archive
                fileTransfer.download(
                    // Source
                    uri, 
                    // Destination
                    filePath, 
                    // Success callback 
                    function(entry) {
                        app.utils.setLoadingMsg("Extraction de la mise à jour");
                        // Unzip Assets
                        zip.unzip(filePath, rootPath, function(){
                            if(DEBUG) console.log('unzip success');
                            cb();
                        });
                    },
                    // Error callback
                    function(error) {
                        if(DEBUG) console.log("download error source " + error.source);
                        if(DEBUG) console.log("download error target " + error.target);
                        if(DEBUG) console.log("upload error code" + error.code);
                        cb();
                    },
                    // Misc
                    false,
                    {
                        headers: {}
                    }
                );
            }, function(error){ 
                if(DEBUG) console.error('Filesystem error');
                cb();
            });
        } else {
            if(DEBUG) console.error('Plugins "zip" & "file-transfer" not available (local mode ?)');
            cb();
        }
    },

    appendAssets: function(cb){
        var link = document.createElement("link");
        link.type = "text/css";
        link.rel = "stylesheet";

        var script = document.createElement("script");
        script.type = "text/javascript";

        if(typeof FileTransfer !== 'undefined' && typeof zip !== 'undefined'){
            window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, function (fileSystem) {

                // Get filesystem's relative cache folder
                var rootPath = fileSystem.root.toURL();
                
                link.href = rootPath+"assets/index.css";
                script.src = rootPath+"assets/index.js";

                document.getElementsByTagName("head")[0].appendChild(link);
                document.getElementsByTagName("head")[0].appendChild(script);
                cb();
            });
        } else {
            link.href = DEBUG_WWW_URL+"assets/index.css";
            script.src = DEBUG_WWW_URL+"assets/index.js";

            document.getElementsByTagName("head")[0].appendChild(link);
            document.getElementsByTagName("head")[0].appendChild(script);
            cb();
        }
    },

    // Application starter
    start: function(){
        if(DEBUG) console.log('start '+JSON.stringify(app.manifest));
        app.utils.setLoadingMsg("Démarrage de l'application");

        // Default route to home
        app.manifest.id = app.current_page = 'home';
        
        // Dev page refresh : redirect to home
        window.location.hash = '#home'

        // Import Scripts & Styles
        app.appendAssets(function(){ 

            // Regiter pages tree
            app.registerPage(app.manifest);
    
            // Render Homepage
            app.render(app.manifest);

            // Listen for search form submission
            var $form = document.getElementById('momo-search');
            $form.addEventListener('submit', app.onSearchSubmit, false);
        });
    },

    // Recursive function to index page from JSON Manifest
    registerPage: function(data){

        if(data instanceof Object){

            // Generate a page ID
            var id = data.id = data.id ? data.id : (data.title ? app.utils.hyphenate(data.title) : '_' + Math.random().toString(36).substr(2, 9));

            // Make sure id is unique
            var i = 1;
            while(app.pages.hasOwnProperty(data.id)){
                data.id = id+'_'+i.toString();
            }

            // Register page
            app.pages[data.id] = data;

            // Register menu items
            if(data.menu instanceof Array){
                for(var i = 0; i < data.menu.length; i++){
                    var page = data.menu[i];
                    app.menu[i] = app.registerPage(page, false);
                }
            }

            // Register page childrens
            if(data.pages instanceof Array){
                for(var i = 0; i < data.pages.length; i++){
                    var page = data.pages[i];
                    app.pages[data.id].pages[i] = app.registerPage(page, false);
                }
            }

            // Register seealso childrens
            if(data.seealso instanceof Array){
                for(var i = 0; i < data.seealso.length; i++){
                    var page = data.seealso[i];
                    app.pages[data.id].seealso[i] = app.registerPage(page, false);
                }
            }

            // Index page for search engine
            app.index.add({
                id: data.id,
                title: data.title,
                body: data.content
            });
            
            return data.id;
        } else
        if(typeof data === 'string' || data instanceof String || data instanceof Number){
            return data;
        }
    },

    // Render Application
    render: function(data){

        // Render Main section
        var $main  = tmpl("momo-main-tmpl", data);
        document.getElementById('momo-main').innerHTML = $main;

        // Render every menu items
        for(var i in app.menu){
            var $menuItem = document.createElement('li');
            var data = app.utils.extend(app.pages[app.menu[i]], { header: true });
            $menuItem.innerHTML = tmpl("momo-list-item-tmpl", data);
            document.getElementById('momo-menu').appendChild($menuItem);
        }

        // Render navigation
        app.nav = responsiveNav(".momo-nav-collapse", { // Selector
            animate: true, // Boolean: Use CSS3 transitions, true or false
            transition: 284, // Integer: Speed of the transition, in milliseconds
            //label: "Menu", // String: Label for the navigation toggle
            //insert: "before", // String: Insert the toggle before or after the navigation
            customToggle: "momo-menu-toggle", // Selector: Specify the ID of a custom toggle
            closeOnNavClick: true, // Boolean: Close the navigation when one of the links are clicked
            openPos: "relative", // String: Position of the opened nav, relative or static
            navClass: "nav-collapse", // String: Default CSS class. If changed, you need to edit the CSS too!
            navActiveClass: "active", // String: Class that is added to <html> element when nav is active
            jsClass: "js", // String: 'JS enabled' class which is added to <html> element
            init: function(){}, // Function: Init callback
            open: function(){}, // Function: Open callback
            close: function(){} // Function: Close callback
        });

        // Render every page
        for(var page in app.pages){
            //app.renderPage(app.pages[page]);
            var $page = document.createElement('div');
            $page.id = app.pages[page].id;
            $page.className = "momo-page";
            if($page.id == 'home'){
                $page.classList.add('momo-page-current');
                $page.innerHTML = app.renderPage(app.pages[page]);
            }
            document.getElementById('momo-pages').appendChild($page);
        }
    },

    // Render Page
    renderPage: function(page){
        if(page instanceof Object){
            if(DEBUG) console.log('render page '+JSON.stringify(page));

            // Get data to display
            var data = app.utils.extend(page, {meta: app.manifest.meta});

            // Change page header
            document.getElementById("momo-header").innerHTML = tmpl("momo-header-tmpl", data);

            // Render Page
            return tmpl("momo-page-tmpl", data);
        } else
        if(typeof page === 'string' || page instanceof String || page instanceof Number){
            if(DEBUG) console.log('render page '+page);
            return app.renderPage(app.pages[page]);
        }
    },

    // Navigate to page
    navigate: function(page, back){
        var page_obj = app.pages[page];

        if(page_obj.external && back){
            window.history.back();
            return false;
        } else
        if(page_obj.external){
            app.utils.openExternalURL(page_obj.url, page_obj.inAppBrowser);
            return false;
        }

        // Keep try to navigate until previous animation is done.
        if(app.isAnimating) {
            setTimeout(function(){
                app.navigate(page, back);
            }, 100);
            return false;
        }

        app.isAnimating = true;

        var $outpage = document.getElementById(app.current_page);
        var $inpage  = document.getElementById(page);

        if(!ANIMATION_ENABLED){
            $inpage.classList.add('momo-page-current');
            $outpage.classList.remove('momo-page-current');
        } else {

            var outCb = function(){
                $outpage.removeEventListener('animationend',       outCb);
                $outpage.removeEventListener('webkitAnimationEnd', outCb);
                $outpage.removeEventListener('oAnimationEnd',      outCb);
                $outpage.removeEventListener('MSAnimationEnd',     outCb);
                app.endCurrPage = true;
                if(app.endNextPage){
                    app.onAnimationEnd($outpage, $inpage, back);
                }
            };

            var inCb = function(){
                $inpage.removeEventListener('animationend',       inCb);
                $inpage.removeEventListener('webkitAnimationEnd', inCb);
                $inpage.removeEventListener('oAnimationEnd',      inCb);
                $inpage.removeEventListener('MSAnimationEnd',     inCb);
                app.endNextPage = true;
                if(app.endCurrPage){
                    app.onAnimationEnd($outpage, $inpage, back);
                }
            };

            var out_classes = (back ? ANIMATION_BACK_OUT_CLASS : ANIMATION_OUT_CLASS).split(' ');
            for(var i = 0; i < out_classes.length; i++)
                $outpage.classList.add(out_classes[i]);
            $outpage.addEventListener('animationend',       outCb, false);
            $outpage.addEventListener('webkitAnimationEnd', outCb, false);
            $outpage.addEventListener('oAnimationEnd',      outCb, false);
            $outpage.addEventListener('MSAnimationEnd',     outCb, false);

            $inpage.classList.add('momo-page-current');
            $inpage.innerHTML = app.renderPage(page_obj);

            var in_classes = (back ? ANIMATION_BACK_IN_CLASS : ANIMATION_IN_CLASS).split(' ');
            for(var i = 0; i < in_classes.length; i++)
                $inpage.classList.add(in_classes[i]);
            $inpage.addEventListener('animationend',       inCb, false);
            $inpage.addEventListener('webkitAnimationEnd', inCb, false);
            $inpage.addEventListener('oAnimationEnd',      inCb, false);
            $inpage.addEventListener('MSAnimationEnd',     inCb, false);
        }

        app.current_page = page;
    },

    // Animation Callback
    onAnimationEnd: function($outpage, $inpage, back) {
        app.endCurrPage = false;
        app.endNextPage = false;
        var out_classes = (back ? ANIMATION_BACK_OUT_CLASS : ANIMATION_OUT_CLASS).split(' ');
        for(var i = 0; i < out_classes.length; i++)
            $outpage.classList.remove(out_classes[i]);
        if($outpage != $inpage)
            $outpage.classList.remove('momo-page-current');
        var in_classes = (back ? ANIMATION_BACK_IN_CLASS : ANIMATION_IN_CLASS).split(' ');
        for(var i = 0; i < in_classes.length; i++)
            $inpage.classList.remove(in_classes[i]);
        app.isAnimating = false;
    },

    onTouchStart: function(e) {
        e = e || window.event;
        var targ = e.target || e.srcElement;
        if (targ.nodeType == 3) targ = targ.parentNode;
        //return targ.onclick();
    },

    // Location Hash change event
    onHashChange: function(e) {
        var hash = window.location.hash, length = window.history.length;
        var page = window.location.hash.slice(1);

        if(!app.pages.hasOwnProperty(page)){
            page = 'home';
        } 

        var back = page == 'home';

        if (app.hashHistory.length && app.historyLength == length) {
            if (app.hashHistory[app.hashHistory.length - 2] == hash) {
                app.hashHistory = app.hashHistory.slice(0, -1);
                back = true; 
            } else {
                app.hashHistory.push(hash);
            }
        } else {
            app.hashHistory.push(hash);
            app.historyLength = length;
        }

        if(app.current_page != page){
            app.navigate(page, back);
        }
    },

    onSearchSubmit: function(e){
        // Stop form default action
        e.preventDefault();
        //e.stopPropagation();

        // Get search input
        var $searchInput = document.getElementById('momo-search-input');
        var searchInput = app.utils.replaceAccents($searchInput.value);
        var id = "search-"+app.utils.hyphenate(searchInput);

        // Close navigation + Keyboard
        app.nav.close();
        $searchInput.value = '';
        $searchInput.blur();

        // If search query doesn't exist
        if(!document.getElementById(id)){

            // Get search results
            var results = app.index.search(searchInput);

            // Register new search results page
            app.pages[id] = {
                id: id,
                icon: "fa fa-search",
                title: 'Recherche "'+searchInput+'"',
                content: results.length ? null : '<div class="well text-center text-muted">Aucun resultat</div>',
                pages: results.map(function(item){
                    return item.ref;
                })
            };

            // Generate result page view
            var $page = document.createElement('div');
            $page.id = id
            $page.className = "momo-page";
            $page.innerHTML = app.renderPage(app.pages[id]);
            document.getElementById('momo-pages').appendChild($page);
        }

        // Navigate to search result page
        window.location.hash = "#"+id;

        return false;
    },

    // Various Javascript Helpers
    utils: {

        setLoadingMsg: function(text){
            var elements = document.getElementsByClassName("momo-loading-text");
            for (var i = 0; i < elements.length; i++)
                elements[i].innerHTML = text;
        },

        onExternalLinkClick: function(e){
            e = e || window.event;
            var targ = e.target || e.srcElement;
            if (targ.nodeType == 3) targ = targ.parentNode;
            var url = targ.getAttribute("href");
            app.utils.openExternalURL(url);
            return false;
        },

        openExternalURL: function(url, inAppBrowser){
            if(inAppBrowser){
                cordova.InAppBrowser.open(url);
            } else {
                if(navigator.app) // Android
                    navigator.app.loadUrl(encodeURI(url), { openExternal:true });
                else // iOS and others
                    window.open(encodeURI(url), "_system", 'location=yes'); // opens in the app, not in safari
            }
            return false;
        },

        extend: function ( defaults, options ) {
            var extended = {};
            var prop;
            for (prop in defaults) {
                if (Object.prototype.hasOwnProperty.call(defaults, prop)) {
                    extended[prop] = defaults[prop];
                }
            }
            for (prop in options) {
                if (Object.prototype.hasOwnProperty.call(options, prop)) {
                    extended[prop] = options[prop];
                }
            }
            return extended;
        },

        trim: function(str){
            return (str || '').replace(/^\s+|\s+$/g, '');
        },

        removeNonWord: function(str){
            return (str || '').replace(/[^0-9a-zA-Z\xC0-\xFF \-]/g, ''); //remove non-word chars
        },

        replaceAccents: function(str){
            str = str || '';
            // verifies if the String has accents and replace them
            if (str.search(/[\xC0-\xFF]/g) > -1) {
                str = str
                .replace(/[\xC0-\xC5]/g, "A")
                .replace(/[\xC6]/g, "AE")
                .replace(/[\xC7]/g, "C")
                .replace(/[\xC8-\xCB]/g, "E")
                .replace(/[\xCC-\xCF]/g, "I")
                .replace(/[\xD0]/g, "D")
                .replace(/[\xD1]/g, "N")
                .replace(/[\xD2-\xD6\xD8]/g, "O")
                .replace(/[\xD9-\xDC]/g, "U")
                .replace(/[\xDD]/g, "Y")
                .replace(/[\xDE]/g, "P")
                .replace(/[\xE0-\xE5]/g, "a")
                .replace(/[\xE6]/g, "ae")
                .replace(/[\xE7]/g, "c")
                .replace(/[\xE8-\xEB]/g, "e")
                .replace(/[\xEC-\xEF]/g, "i")
                .replace(/[\xF1]/g, "n")
                .replace(/[\xF2-\xF6\xF8]/g, "o")
                .replace(/[\xF9-\xFC]/g, "u")
                .replace(/[\xFE]/g, "p")
                .replace(/[\xFD\xFF]/g, "y");
            }
            return str;
        },

        slugify: function(str, delimeter){
            if (delimeter == null) {
                delimeter = "-";
            }
            str = app.utils.replaceAccents(str);
            str = app.utils.removeNonWord(str);
            str = app.utils.trim(str) //should come after removeNonWord
            .replace(/ +/g, delimeter) //replace spaces with delimeter
            .toLowerCase();
            return str;
        },

        unCamelCase: function(str){
            return (str || '').replace(/([a-z\xE0-\xFF])([A-Z\xC0\xDF])/g, '$1 $2').toLowerCase(); //add space between camelCase text
        },

        hyphenate: function(str){
            str = app.utils.unCamelCase(str);
            return app.utils.slugify(str, "-");
        }
    }
};

if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.slice(0, str.length) == str;
  };
}
if (typeof String.prototype.endsWith != 'function') {
  String.prototype.endsWith = function (str){
    return this.slice(-str.length) == str;
  };
}
