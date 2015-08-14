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
var DEBUG = false;
var DEBUG_WWW_URL = 'http://localhost/~ghis/momo/www/';
var ANIMATION_ENABLED = true;
var ANIMATION_OUT_CLASS  = 'pt-page-moveToLeftEasing pt-page-ontop';
var ANIMATION_IN_CLASS = 'pt-page-moveFromRight';
var ANIMATION_BACK_OUT_CLASS  = 'pt-page-moveToRightEasing pt-page-ontop';
var ANIMATION_BACK_IN_CLASS = 'pt-page-moveFromLeft';
var ON_PULL = 'checkForUpdate'; // || 'update'

// Application
var app = {

    // Pages Registry
    pages: {},

    // Minimal Default Manifest
    manifest: {
        meta: {
            'title': 'Momo Application',
            'icon': 'icon.png',
            'contact': 'contact@cadoles.com',
            'manifestUrl': 'index.json',
            'assetsUrl': 'assets.zip',
            'updateFreq': 0,
            'content': tmpl('momo-first-launch-tmpl'),
            'titlePersitent': true,
            'titleSeparator': "<br>"
        },
        menu: []
    },

    // Default page attributes
    defaultPage: {
        colxs: 4,
        colsm: 3,
        colmd: 2,
        collg: 1,
        menu: []
    },

    // Misc Data
    current       : 0,
    isAnimating   : false,
    endCurrPage   : false,
    endNextPage   : false,
    hashHistory   : [window.location.hash],
    historyLength : window.history.length,
    rootPath      : '',
    hasStarted    : false,
    assetsMtime   : null,
    manifestMtime : null,
    updateTimeout : null,

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

        // Init search engine index
        app.initIndex();

        // Load manifest from localStorage
        app.loadLocalManifest();

        // Check for new updates
        app.checkForUpdate(app.start, app.start);

        // Update Reminder
        app.updateTimeout = setTimeout( app.checkForLastUpdateCheck, app.manifest.meta.updateFreq );

        // Touch events faster response patch
        FastClick.attach(document.body);
    },

    // Initialize search engine index
    initIndex: function(){
        app.index = lunr(function () {
            this.use(lunr.fr);
            this.field('title', {boost: 10});
            this.field('keywords', {boost: 5});
            this.field('content');
            this.ref('id');
            this.pipeline.add(function (token, tokenIndex, tokens) {
                if(token.length > 2)
                    return app.utils.replaceAccents(token);
            });
        });
    },

    checkForLastUpdateCheck: function(resolve, reject){
        // Checklast Update
        var lastUpdate   = localStorage.getItem("momo-timestamp") ? new Date(localStorage.getItem("momo-timestamp")) : new Date(0);
        var timeDiff     = ((new Date()).getTime() - lastUpdate.getTime()) / 1000;
        var updateRequired   = timeDiff > app.manifest.meta.updateFreq;

        if(updateRequired)
            app.flash("Vérifiez si un nouvelle mise à jour est disponible en tirant la page vers les bas", "info");

        if(typeof resolve === 'function')
            resolve(updateRequired);
    },

    checkForUpdate: function(resolve, reject) {
        app.utils.setLoadingMsg("Verification des mises à jour");

        var manifestReady = false;
        var assetsReady = false;
        var updateAvailable = false;
        var updateError = false;

        var onGetMtime = function(key, mtime, ready) {
            old_mtime = localStorage.getItem("momo-"+key+"-mtime");
            if (mtime) {
                if(mtime != old_mtime) {
                    updateAvailable = true;
                }
            } else {
                updateError = true;
            }
            if(ready){
                if(updateError){
                    if(DEBUG) console.error('Error checking for updates');
                    app.flash("Impossible de détecter des nouvelles mises à jour", 'danger');
                    if(typeof reject === 'function')
                        reject();
                } else {
                    if(updateAvailable){
                        app.flash(tmpl('momo-update-available-tmpl', { mtime: app.utils.formatDate(mtime) }), 'success');
                        app.utils.setLoadingMsg("Mise à jour disponible !");
                    } else {
                        app.utils.setLoadingMsg("Aucunes nouvelles mises à jour");
                    }
                    if(typeof resolve === 'function')
                        resolve(updateAvailable);
                }
            }
        };

        app.utils.getModifiedTime(app.manifest.meta.manifestUrl, function(mtime) {
            app.manifestMtime = mtime;
            onGetMtime('manifest', mtime, assetsReady);
            manifestReady = true;
        });
        app.utils.getModifiedTime(app.manifest.meta.assetsUrl, function(mtime) {
            app.assetsMtime = mtime;
            onGetMtime('assets', mtime, manifestReady);
            assetsReady = true;
        });
    },

    loadLocalManifest: function() {
        var manifest;
        if(manifest = localStorage.getItem("momo-manifest")){
            try {
                app.manifest = JSON.parse(manifest);
            } catch(e) {}
        }
    },

    // JSON Manifest loading function
    loadManifest: function(resolve, reject){
        if(DEBUG) console.log('load '+JSON.stringify(app.manifest));
        app.utils.setLoadingMsg("Mise à jour du manifest - 0%");

        // In case the url is incorrect, we get the backup manifest

        app.safeManifest = app.manifest;

        // Get manifest from localStorage if it exists
        app.loadLocalManifest();

        // Start AJAX
        var url          = app.manifest.meta.manifestUrl;
        var request      = new XMLHttpRequest();

        request.open('GET', app.utils.addParameter(url, 'timestamp', (+new Date), true), true);

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

                        // Reload if new manifest url
                        if(url != app.manifest.meta.manifestUrl){
                            app.loadManifest(resolve, reject);
                        } else  {
                            if(typeof resolve === "function")
                                resolve();
                        }
                    } catch(e) {
                        if(DEBUG) console.log('Cannot parse application manifest '+url);
                        app.flash('Le manifest JSON comporte des erreurs', 'danger');
                        if(typeof reject === "function")
                            reject();

                    }
                });

            // Handle AJAX Error
            } else {
                app.onAjaxError(url, request);
                if(typeof reject === "function")
                    reject();
            }
        };

        // Handle AJAX Error
        request.onerror = function() {
            app.onAjaxError(url);
            if(typeof reject === "function")
                reject();
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
                var manifestResponse = response.replace(/(['"\(])\/?(assets\/[^'"\)]*)(['"\)])/g, function(match, q1, path, q2){
                    return q1+rootPath+path+q2;
                });

                // Callback
                cb(manifestResponse);

            });
        } else {
            var manifestResponse = response.replace(/(['"\(])\/?(assets\/[^'"\)]*)(['"\)])/g, function(match, q1, path, q2){
                return q1+DEBUG_WWW_URL+path+q2;
            });
            cb(manifestResponse);
        }
    },

    // Get distant zip asset archive and update local cache
    loadAssets: function(resolve, reject){

        if(DEBUG) console.log('fetch assets');
        app.utils.setLoadingMsg("Téléchargement des assets - 0%");

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
                        zip.unzip(filePath, rootPath,
                            // Success callback
                            function(ret){
                                if(DEBUG) console.log('unzip success');
                                app.utils.setLoadingMsg("Téléchargement des assets - 100%");
                                if(ret == 0) {
                                    if(typeof resolve === 'function')
                                        resolve();
                                } else 
                                if(ret == -1) {
                                    if(typeof reject === 'function')
                                        reject();
                                }
                            },
                            // Progress callback
                            function(e){
                                var progress = Math.round((e.loaded / e.total) * 100);
                                app.utils.setLoadingMsg("Téléchargement des assets - "+progress+"%");
                            }
                        );
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
                app.utils.setLoadingMsg("Erreur du système de fichier");
                app.flash("Erreur du système de fichier", 'danger');
                if(typeof reject === 'function')
                    reject();
            });
        } else {
            if(DEBUG) console.error('Plugins "zip" & "file-transfer" not available (local mode ?)');
            app.utils.setLoadingMsg("Plugin 'zip' indisponible");
            app.flash("Plugin 'zip' indisponible", 'danger');
            if(typeof reject === 'function')
                reject();
        }
    },

    appendAssets: function(resolve, reject){
        var append = function(rootPath){

            // Link Tag
            var link = document.createElement("link");
            link.type = "text/css";
            link.rel = "stylesheet";
            link.href = rootPath+"assets/index.css";

            // Script tag
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = rootPath+"assets/index.js";

            // Delete previous link tags
            var els = document.getElementsByTagName("link"),
              els_length = els.length;
            for (var i = 0, l = els_length; i < l; i++) {
                var el = els[i];
                if (el.href === link.href) {
                    delete el;
                }
            }

            // Delete previous scripts tags
            els = document.getElementsByTagName("script");
            els_length = els.length;
            for (var i = 0, l = els_length; i < l; i++) {
                var el = els[i];
                if (el.src === script.src) {
                    delete el;
                }
            }

            // Reinsert
            document.getElementsByTagName("head")[0].appendChild(link);
            document.getElementsByTagName("head")[0].appendChild(script);

            if(typeof resolve === 'function')
                resolve();
        };

        if(typeof FileTransfer !== 'undefined' && typeof zip !== 'undefined'){
            window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, function (fileSystem) {

                // Get filesystem's relative cache folder
                var rootPath = fileSystem.root.toURL();
                append(rootPath);
            });
        } else {
            append(DEBUG_WWW_URL);
        }
    },

    // Application starter
    start: function(resolve, reject){
        if(DEBUG) console.log('start '+JSON.stringify(app.manifest));
        app.utils.setLoadingMsg("Démarrage de l'application");
        app.hasStarted = true;

        // Default route to home
        app.manifest.id = app.current_page = 'home';
        
        // Dev page refresh : redirect to home
        window.location.replace('#home');

        // Regiter pages tree
        app.registerPage(app.manifest, app.defaultPage);
    
        // Render Homepage
        app.render(app.manifest);

        // Navigate to home
        app.navigate('home', false, function(){

            // Append assets
            app.appendAssets(resolve, reject);
        });

        // Listen for search form submission
        var $form = document.getElementById('momo-search');
        $form.addEventListener('submit', app.onSearchSubmit, false);
    },

    // Recursive function to index page from JSON Manifest
    registerPage: function(data, parentPage){

        if(data instanceof Object){

            // Extends default page
            data = app.utils.extend(app.defaultPage, data);

            // Generate a page ID
            var id = data.id = data.id ? data.id : (data.title ? app.utils.hyphenate(data.title.stripTags()) : '_' + Math.random().toString(36).substr(2, 9));

            // Make sure id is unique
            var i = 1;
            while(app.pages.hasOwnProperty(data.id)){
                data.id = id+'_'+i.toString();
            }

            // Register page
            app.pages[data.id] = data;

            // Register menu items
            if(data.menu instanceof Array && data.menu.length > 0){
                for(var i = 0; i < data.menu.length; i++){
                    var page = data.menu[i];
                    app.pages[data.id].menu[i] = app.registerPage(page, data);
                }
            } else {
                app.pages[data.id].menu = parentPage.menu;
            }

            // Register hidden pages childrens
            if(data._pages instanceof Array){
                for(var i = 0; i < data._pages.length; i++){
                    var page = data._pages[i];
                    app.pages[data.id]._pages[i] = app.registerPage(page, data);
                }
            }

            // Register page childrens
            if(data.pages instanceof Array){
                for(var i = 0; i < data.pages.length; i++){
                    var page = data.pages[i];
                    app.pages[data.id].pages[i] = app.registerPage(page, data);
                }
            }

            // Register seealso childrens
            if(data.seealso instanceof Array){
                for(var i = 0; i < data.seealso.length; i++){
                    var page = data.seealso[i];
                    app.pages[data.id].seealso[i] = app.registerPage(page, data);
                }
            }

            // Index page for search engine
            app.index.add({
                id: data.id,
                title: data.title,
                body: data.content,
                keywords: data.keywords
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


        // Render every page
        for(var page in app.pages){
            var $page = document.createElement('div');
            $page.id = app.pages[page].id;
            $page.className = "momo-page";
            //if($page.id == 'home'){
            //    $page.classList.add('momo-page-current');
            //    $page.innerHTML = app.renderPage(app.pages[page]);
            //    document.title = app.pages[page].title;
            //}
            document.getElementById('momo-pages').appendChild($page);
        }

    },

    // Render Page
    renderPage: function(page){
        if(page instanceof Object){
            if(DEBUG) console.log('render page '+JSON.stringify(page));

            // Render every menu items
            document.getElementById('momo-menu').innerHTML = "";

            for(var i in page.menu){
                var $menuItem = document.createElement('li');
                var data = app.utils.extend(app.pages[page.menu[i]], { header: true });
                $menuItem.innerHTML = tmpl("momo-list-item-tmpl", data);
                document.getElementById('momo-menu').appendChild($menuItem);
            }

            // Render navigation
            if(page.menu != app.pages[app.current_page].menu || !app.nav){
                if(app.nav)
                    app.nav.destroy();
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
            }
            app.nav.unbindEvents();
            app.nav.bindEvents();

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
    navigate: function(page, back, cb){
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
                app.navigate(page, back, cb);
            }, 100);
            return false;
        }

        app.isAnimating = true;
        document.title = page_obj.title;

        var $outpage = document.getElementById(app.current_page);
        var $inpage  = document.getElementById(page);

        // Render page (with small hack, so it doesn't mess up the display)
        $inpage.innerHTML = app.renderPage(page_obj);

        // Pull to update binder
        app.bindPagePull($inpage);

        if(!ANIMATION_ENABLED || app.current_page == page){
            $inpage.classList.add('momo-page-current');
            app.onAnimationEnd($outpage, $inpage, back, cb);
        } else {

            var outCb = function(){
                $outpage.removeEventListener('animationend',       outCb);
                $outpage.removeEventListener('webkitAnimationEnd', outCb);
                $outpage.removeEventListener('oAnimationEnd',      outCb);
                $outpage.removeEventListener('MSAnimationEnd',     outCb);
                app.endCurrPage = true;
                if(app.endNextPage){
                    app.onAnimationEnd($outpage, $inpage, back, cb);
                }
            };

            var inCb = function(){
                $inpage.removeEventListener('animationend',       inCb);
                $inpage.removeEventListener('webkitAnimationEnd', inCb);
                $inpage.removeEventListener('oAnimationEnd',      inCb);
                $inpage.removeEventListener('MSAnimationEnd',     inCb);
                app.endNextPage = true;
                if(app.endCurrPage){
                    app.onAnimationEnd($outpage, $inpage, back, cb);
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

    bindPagePull: function($page) {
        WebPullToRefresh.destroy();
        WebPullToRefresh.init( {
            loadingFunction: function(){
                if(ON_PULL == "checkForUpdate")
                    return new Promise( app.checkForUpdate );
                else
                if(ON_PULL == "update")
                    return new Promise( app.update );
            },
            contentEl: $page
        } );
    },

    // Animation Callback
    onAnimationEnd: function($outpage, $inpage, back, cb) {
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
        if(typeof cb == "function")
            cb();
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

        if(page == 'momo-update'){
            window.location.replace(app.hashHistory[app.hashHistory.length-1]);
            document.body.classList.add('ptr-loading');
            var cb = function() {
                setTimeout(function(){
                    document.body.classList.remove('ptr-loading');
                    document.body.classList.add('ptr-reset');
                    setTimeout(function() {
                        document.body.classList.remove('ptr-reset');
                    }, 250);
                }, 1000);
            };
            return app.update(cb, cb);
            return window.history.back();
        } else
        if(page == 'momo-blank'){
            return window.location.replace(app.hashHistory[app.hashHistory.length-1]);
            return window.history.back();
        }

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
        var searchInput = $searchInput.value;

        // Close navigation + Keyboard
        app.nav.close();
        $searchInput.value = '';
        $searchInput.blur();

        // Search
        app.search(searchInput);

        return false;
    },

    search: function(query){
        var id = "search-"+app.utils.hyphenate(query);

        // Store current query
        app.current_query = query;

        // Get search results
        var results = app.index.search(app.utils.replaceAccents(query));

        // Register new search results page
        app.pages[id] = {
            id: id,
            search: query,
            icon: "fa fa-search",
            title: 'Recherche "'+query+'"',
            content: results.length ? null : '<div class="well text-center text-muted">Aucun resultat</div>',
            pages: results.map(function(item){
                return item.ref;
            }),
            menu: app.pages[app.current_page].menu
        };

        var $page = document.getElementById(id);

        // If search query doesn't exist
        if(!$page){
            // Generate result page view
            $page = document.createElement('div');
            $page.id = id
            $page.className = "momo-page";
            document.getElementById('momo-pages').appendChild($page);
        }

        // Render page
        $page.innerHTML = app.renderPage(app.pages[id], app.pages[app.current_page]);

        // Navigate to search result page
        window.location.hash = "#"+id;
    },

    flash: function(message, type) {
        var elements = document.getElementsByClassName("momo-flash-messages");
        for (var i = 0; i < elements.length; i++) {
            elements[i].innerHTML = "";
        }
        setTimeout(function(){
            var elements = document.getElementsByClassName("momo-flash-messages");
            for (var i = 0; i < elements.length; i++) {
                elements[i].innerHTML += tmpl('momo-flash-message-tmpl', { 
                    message: message,
                    type: type ? type : 'info'  
                });
            }
        }, 200);
    },
    
    update: function( resolve, reject ) {
        var els = document.getElementsByTagName("a"),
          els_length = els.length;
        for (var i = 0, l = els_length; i < l; i++) {
            var el = els[i];
            if (el.href.split("#")[1] === 'momo-update') {
                el.classList.add('disabled');
            }
        }

        var appendAssets = function(_resolve, _reject){
            app.appendAssets(
                function(){
                    app.reset(_resolve, _reject);
                }, 
                function(){
                    app.reset(_reject, _reject);
                }
            );
        };

        var loadAssets = function(_resolve, _reject){
            app.loadAssets(
                function(){
                    appendAssets(_resolve, _reject);       
                },
                function(){
                    app.reset(_reject, _reject);
                }
            );
        };

        app.loadManifest(
            function(){
                localStorage.setItem('momo-manifest-mtime', app.manifestMtime);
                localStorage.setItem('momo-assets-mtime', app.assetsMtime);
                loadAssets(resolve, reject);
            },
            function(){
                loadAssets(resolve, reject);
            }
        );
    },

    reset: function(resolve, reject){
        // Update Reminder
        clearTimeout(app.updateTimeout);
        app.updateTimeout = setTimeout( app.checkForLastUpdateCheck, app.manifest.meta.updateFreq );

        for(var page in app.pages){
            if(typeof app.pages[page].search == 'undefined'){
                delete app.pages[page];
                document.getElementById("momo-pages").removeChild(
                    document.getElementById(page)
                );
            }
        }
        // Regiter pages tree
        app.manifest.id = 'home';
        app.registerPage(app.manifest, app.defaultPage);

        // Render every page
        for(var page in app.pages){
            var $page = document.getElementById(page);
            if(!$page){
                $page = document.createElement('div');
                $page.id = app.pages[page].id;
                $page.className = "momo-page";
                document.getElementById('momo-pages').appendChild($page);
            }
        }

        // Check for url change in manifest
        app.checkForUpdate(function(updateAvailable){
            if(updateAvailable)
                app.update(resolve, reject);
            else
                app.utils.setLoadingMsg("Mise à jour effectuée !");
            if(typeof resolve === 'function')
                resolve();
        }, function(){
            if(typeof reject === 'function')
                reject();
        });

        if(typeof app.pages[app.current_page].search != 'undefined'){
            app.search(app.current_query);
        } else {
            app.navigate(app.current_page);
        }
    },


    // Various Javascript Helpers
    utils: {

        removeElement: function($el){
            $el.parentElement.removeChild($el);
            return false;
        },

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
        },

        addParameter: function(url, parameterName, parameterValue, atStart/*Add param before others*/){
            replaceDuplicates = true;
            if(url.indexOf('#') > 0){
                var cl = url.indexOf('#');
                urlhash = url.substring(url.indexOf('#'),url.length);
            } else {
                urlhash = '';
                cl = url.length;
            }
            sourceUrl = url.substring(0,cl);

            var urlParts = sourceUrl.split("?");
            var newQueryString = "";

            if (urlParts.length > 1)
            {
                var parameters = urlParts[1].split("&");
                for (var i=0; (i < parameters.length); i++)
                {
                    var parameterParts = parameters[i].split("=");
                    if (!(replaceDuplicates && parameterParts[0] == parameterName))
                    {
                        if (newQueryString == "")
                            newQueryString = "?";
                        else
                            newQueryString += "&";
                        newQueryString += parameterParts[0] + "=" + (parameterParts[1]?parameterParts[1]:'');
                    }
                }
            }
            if (newQueryString == "")
                newQueryString = "?";

            if(atStart){
                newQueryString = '?'+ parameterName + "=" + parameterValue + (newQueryString.length>1?'&'+newQueryString.substring(1):'');
            } else {
                if (newQueryString !== "" && newQueryString != '?')
                    newQueryString += "&";
                newQueryString += parameterName + "=" + (parameterValue?parameterValue:'');
            }
            return urlParts[0] + newQueryString + urlhash;
        },

        getModifiedTime: function(url, callback) {
          var xhr = new XMLHttpRequest();
          xhr.open('HEAD', url, true); // use HEAD - we only need the headers
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
              var mtime = new Date(xhr.getResponseHeader('Last-Modified'));
              if (mtime.toString() === 'Invalid Date') {
                callback(); // dont want to return a bad date
              } else {
                callback(mtime);
              }
            }
          }
          xhr.send();
        },

        formatDate: function(date){
            var d = date,
            minutes = d.getMinutes(),//.toString().length == 1 ? '0'+d.getMinutes() : d.getMinutes(),
            hours = d.getHours(),//.toString().length == 1 ? '0'+d.getHours() : d.getHours(),
            //ampm = d.getHours() >= 12 ? 'pm' : 'am',
            //months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            //days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            months = ['Janvier','Février','Mars','Avril','Mai','Juin','Jullet','Août','Septempbre','Octobre','Novembre','Décembre'],
            days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
            //return days[d.getDay()]+' '+months[d.getMonth()]+' '+d.getDate()+' '+d.getFullYear()+' '+hours+':'+minutes;//+ampm;
            return days[d.getDay()]+' '+d.getDate()+' '+months[d.getMonth()]+' '+d.getFullYear()+' '+hours+':'+minutes;//+ampm;
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
if (typeof String.prototype.stripTags != 'function') {
    String.prototype.stripTags = function (){
        return this.replace(/(<([^>]+)>)/ig,"");
    };
}
if (typeof String.prototype.isImage != 'function') {
    String.prototype.isImage = function (){
        return this.endsWith('.png') ||
            this.endsWith('.svg') ||
            this.endsWith('.ico') ||
            this.endsWith('.jpeg') ||
            this.endsWith('.jpg');
    };
}
if (typeof String.prototype.isUrl != 'function') {
    String.prototype.isUrl = function (){
        return this.startsWith('http://') ||
            this.startsWith('https://') ||
            this.startsWith('file://');
    };
}
if (typeof String.prototype.isFramable != 'function') {
    String.prototype.isFramable = function (){
        return this.isImage() || this.isUrl();
    };
}
