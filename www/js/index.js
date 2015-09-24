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

"use strict";

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
            'updateFreq': 60000,
            'default': true,
            'titlePersitent': true,
            'titleSeparator': "<br>",
            'menu': [],
            'stylesheets': [],
            'javascripts': []
        },
        'menu': [],
        'stylesheets': [],
        'javascripts': [],
        'content': tmpl('momo-first-launch-tmpl', {}),
        'footer': undefined
    },

    // Default page attributes
    defaultPage: {
        colxs: 4,
        colsm: 3,
        colmd: 2,
        collg: 1,
        menu: [],
        javascripts: [],
        stylesheets: []
    },

    // Misc Data
    current       : 0,
    isAnimating   : false,
    endCurrPage   : false,
    endNextPage   : false,
    pageIndex     : 0,
    pageHistory   : [/*window.location.hash.slice(1)*/],
    historyLength : window.history.length,
    hasStarted    : false,
    assetsMtime   : null,
    manifestMtime : null,
    updateTimeout : null,
    ignoreHash    : false,
    previousPage  : 'home',
    currentPage   : 'home',
    parentPage    : 'home',
    javascripts   : [],
    stylesheets   : [],
    rootPath      : DEBUG_WWW_URL, //TODO Remove useless calls to fileSystem

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
        if(document.URL.indexOf("http://") === -1 && document.URL.indexOf("https://") === -1) {
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
        var request = new XMLHttpRequest();
        request.open('GET', '../index.json');
        request.onload = function() {
            if (request.status != 200) {
                /* this should never happen */
                app.utils.setLoadingMsg("Initialisation de l'application : erreur de chargement");
            } else {
                var new_manifest = JSON.parse(this.responseText);
                for (var attr in new_manifest.meta) {
                    if (new_manifest.meta.hasOwnProperty(attr)) {
                        app.manifest.meta[attr] = new_manifest.meta[attr];
                    }
                }
                app.manifest.title = new_manifest.title;
                app.manifest.content = new_manifest.content;
                app.manifest.pages = new_manifest.pages;
                app.manifest.footer = new_manifest.footer;
                app.onDefaultManifestLoaded();
            }
        };
        request.send();
    },

    onDefaultManifestLoaded: function() {
        app.initApplication();
    },

    initApplication: function() {
        // Init fileSystem
        app.initFileSystem();

        // Backup assets
        app.backupAssets();

        // Init search engine index
        app.initIndex();

        // Load manifest from localStorage
        app.loadLocalManifest();

        // Check for new updates
        //app.checkForUpdate(app.start, app.start);

        // Update Reminder
        app.updateTimeout = setTimeout( app.checkForLastUpdateCheck, app.manifest.meta.updateFreq );

        // Touch events faster response patch
        FastClick.attach(document.body);

        // Start Application
        app.start();
    },

    initFileSystem: function(){
        // Chrome patch
        window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

        // Register rootPath
        if(typeof FileTransfer !== 'undefined' && typeof zip !== 'undefined' && typeof window.requestFileSystem === 'function'){
            if(DEBUG){ console.log('FileSystem access'); }

            try {
                window.requestFileSystem(LocalFileSystem.TEMPORARY, 0,
                    function(fileSystem){
                        app.rootPath = fileSystem.root.toURL();
                    }, 
                    function(err){
                        if(DEBUG){ console.log('FileSystem unreachable'); }
                        app.flash("Impossible d'écrire sur le périphérique", 'danger');
                        app.rootPath = DEBUG_WWW_URL;
                    }
                );
            } catch(e) {
                if(DEBUG){ console.log('FileSystem error'+e.message); }
                app.rootPath = DEBUG_WWW_URL;
            }
        } else {
            if(DEBUG){ console.log('FileSystem unavaible'); }
            app.rootPath = DEBUG_WWW_URL;
        }
    },

    // Backup permanent assets
    backupAssets: function(){
        var els, i, l;
        els = document.getElementsByTagName("script");
        for(i = 0, l = els.length; i < l; i++) {
            app.javascripts.push(els[i].src);
        }
        els = document.getElementsByTagName("link");
        for(i = 0, l = els.length; i < l; i++) {
            app.stylesheets.push(els[i].href);
        }
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
                if(token.length > 2){
                    return app.utils.replaceAccents(token);
                }
            });
        });
    },

    // Check for last update check
    checkForLastUpdateCheck: function(resolve, reject){
        // Checklast Update
        var lastUpdate   = localStorage.getItem("momo-timestamp") ? new Date(localStorage.getItem("momo-timestamp")) : new Date(0);
        var timeDiff     = ((new Date()).getTime() - lastUpdate.getTime());
        var updateRequired   = timeDiff > app.manifest.meta.updateFreq;

        if(updateRequired){
            app.flash("Vérifiez si une mise à jour est disponible en tirant la page vers le bas", "info");
        }

        if(typeof resolve === 'function'){
            resolve(updateRequired);
        }
    },

    checkForUpdate: function(resolve, reject) {
        app.utils.setLoadingMsg("Vérification des mises à jour");

        var manifestReady = false;
        var assetsReady = false;
        var updateAvailable = false;
        var updateError = false;

        var onGetMtime = function(key, mtime, ready){
            var old_mtime = localStorage.getItem("momo-"+key+"-mtime");
            if (mtime) {
                if(mtime.toString() !== old_mtime) {
                    updateAvailable = true;
                }
            } else {
                updateError = true;
            }
            if(ready){
                if(updateError){
                    if(DEBUG){ console.error('Error checking for updates'); }
                    app.flash("Impossible de détecter des nouvelles mises à jour", 'danger');
                    if(typeof reject === 'function'){
                        reject();
                    }
                } else {
                    /* record that a check for update was succesfully done */
                    localStorage.setItem("momo-timestamp",  (new Date()).toString());

                    if(updateAvailable){
                        app.flash(tmpl('momo-update-available-tmpl', { mtime: app.utils.formatDate(mtime) }), 'success');
                        app.utils.setLoadingMsg("Mise à jour disponible !");
                    } else {
                        app.utils.setLoadingMsg("Aucune nouvelle mises à jour");
                    }
                    if(typeof resolve === 'function'){
                        resolve(updateAvailable);
                    }
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
        // In case the url is incorrect, we get the backup manifest
        app.safeManifest = app.manifest;

        var manifest = localStorage.getItem("momo-manifest");
        if(manifest){
            try {
                app.manifest = JSON.parse(manifest);
                // Override meta
                app.manifest.meta = app.utils.extend(app.safeManifest.meta, app.manifest.meta);
            } catch(e) {
                app.manifest = app.safeManifest;
            }
        }
    },

    // JSON Manifest loading function
    loadManifest: function(resolve, reject){
        if(DEBUG){ console.log('load '+JSON.stringify(app.manifest)); }
        app.utils.setLoadingMsg("Mise à jour du manifest - 0%");

        // Get manifest from localStorage if it exists
        app.loadLocalManifest();

        // Start AJAX
        var url          = app.manifest.meta.manifestUrl;
        var request      = new XMLHttpRequest();

        request.open('GET', app.utils.addParameter(url, 'timestamp', (+new Date()), true), true);

        // AJAX Callback
        request.onload = function() {

            // AJAX success
            if (request.status >= 200 && request.status < 400 || request.status === 0 /* iOS OhMyBuddha!! */) {

                app.utils.setLoadingMsg("Mise à jour du manifest - 99%");

                // Patch raw text response for fileSystem relative paths
                app.patchResponse(request.responseText, function(manifestResponse){

                    app.utils.setLoadingMsg("Mise à jour du manifest - 100%");

                    try {
                        // Override current manifest
                        app.manifest = JSON.parse(manifestResponse);

                        // Override meta
                        app.manifest.meta = app.utils.extend(app.safeManifest.meta, app.manifest.meta);
                        
                        // Store manifest if parsable
                        localStorage.setItem("momo-manifest", manifestResponse);

                        // Reload if new manifest url
                        if(url !== app.manifest.meta.manifestUrl){
                            app.loadManifest(resolve, reject);
                        } else  {
                            if(typeof resolve === "function"){
                                resolve();
                            }
                        }
                    } catch(e) {
                        if(DEBUG){ console.log('Cannot parse application manifest '+url); }
                        app.flash('Le manifest JSON comporte des erreurs', 'danger');
                        app.manifest = app.safeManifest;
                        if(typeof reject === "function"){
                            reject();
                        }
                    }
                });

            // Handle AJAX Error
            } else {
                app.onAjaxError(url, request);
                if(typeof reject === "function"){
                    reject();
                }
            }
        };

        // Handle AJAX Error
        request.onerror = function() {
            if(typeof reject === "function"){
                reject();
            }
            app.onAjaxError(url);
        };

        // Send AJAX
        request.send();
    },

    // Start Application with safe manifest
    onAjaxError: function(url, request){
        if(DEBUG){ console.log("Cannot load "+url+" [Error "+(request ? request.status : 'Unknown')+"]. Loading local manifest instead."); }

        // Store proper manifest
        localStorage.setItem("momo-manifest", JSON.stringify(app.safeManifest));

        // Restore safe manifest 
        app.manifest = app.safeManifest;
    },

    // Patch manifest response to set fileSystem's relative paths (offline)
    patchResponse: function(response, cb){

        var patch = function(jsonText, path) {
            return jsonText.replace(/(['"\(])\/?(assets\/[^'"\)]*)(['"\)])/g, function(match, q1, p, q2){
                return q1+path+p+q2;
            });
        };

        // Phone context requires 'FileTransfer' & 'Zip' plugins
        if(typeof FileTransfer !== 'undefined' && typeof zip !== 'undefined' && typeof window.requestFileSystem === 'function'){
            if(DEBUG){ console.log('FileSystem access'); }

            var onFileSystemGet = function(fileSystem){
                // Get fileSystem's relative cache folder
                var rootPath = app.rootPath = fileSystem.root.toURL();

                // Callback
                cb(patch(response, rootPath));
            };

            try {
                window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, onFileSystemGet, function(err){
                    if(DEBUG){ console.log('FileSystem unreachable'); }
                    app.flash("Impossible d'écrire sur le périphérique", 'danger');
                    cb(patch(response, DEBUG_WWW_URL));
                });
            } catch(e) {
                if(DEBUG){ console.log('FileSystem error'+e.message); }
                cb(patch(response, DEBUG_WWW_URL));
            }
        } else {
            if(DEBUG){ console.log('FileSystem unavaible'); }
            cb(patch(response, DEBUG_WWW_URL));
        }
    },

    // Get distant zip asset archive and update local cache
    loadAssets: function(resolve, reject){

        if(DEBUG){ console.log('fetch assets'); }
        app.utils.setLoadingMsg("Téléchargement des assets - 0%");

        var onFileSystemGet = function(fileSystem){

            var rootPath = app.rootPath = fileSystem.root.toURL();
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
                            if(DEBUG){ console.log('unzip success'); }
                            app.utils.setLoadingMsg("Téléchargement des assets - 100%");
                            if(ret === 0) {
                                if(typeof resolve === 'function') {
                                    resolve();
                                }
                            } else 
                            if(ret === -1) {
                                if(typeof reject === 'function') {
                                    reject();
                                }
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
                    if(DEBUG){ console.log("download error source " + error.source); }
                    if(DEBUG){ console.log("download error target " + error.target); }
                    if(DEBUG){ console.log("upload error code" + error.code); }
                    if(typeof reject === 'function'){
                       reject();
                    }
                },
                // Misc
                false,
                {
                    headers: {}
                }
            );
        };


        if(typeof FileTransfer !== 'undefined' && typeof zip !== 'undefined' && typeof window.requestFileSystem === 'function'){
            try {
                window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, onFileSystemGet, function(err){
                    if(DEBUG){ console.error('Filesystem error'); }
                    app.utils.setLoadingMsg("Erreur du système de fichier");
                    app.flash("Erreur du système de fichier", 'danger');
                    if(typeof reject === 'function'){
                        reject();
                    }
                });
            } catch(e) {
                if(DEBUG){ console.log('FileSystem error : '+e.message); }
                if(typeof reject === 'function'){
                    reject();
                }
            }
        } else {
            if(DEBUG){ console.error('Plugins "zip" & "file-transfer" not available (local mode ?)'); }
            app.utils.setLoadingMsg("Plugin 'zip' indisponible");
            app.flash("Plugin 'zip' indisponible", 'danger');
            if(typeof reject === 'function'){
                reject();
            }
        }
    },

    refreshAssets: function(page){
        var i, j, l, m, file, found, els, el;

        // Refresh scripts
        for(i = 0, l = page.javascripts.length; i < l; i++){
            file = page.javascripts[i];
            found = false;
            els = document.getElementsByTagName("script");
            for (j = 0, m = els.length; j < m; j++) {
                el = els[j];
                if (el.src === file) {
                    found = true;
                } else if(page.javascripts.indexOf(el.src) < 0 && app.javascripts.indexOf(el.src) < 0){
                    el.parentNode.removeChild(el);
                    m = els.length; j--;
                }
            }
            if(!found){
                // Script tag
                var script = document.createElement("script");
                script.type = "text/javascript";
                script.src = file;
                document.getElementsByTagName("head")[0].appendChild(script);
            }
            
        }

        // Refresh stylesheets
        for(i = 0, l = page.stylesheets.length; i < l; i++){
            file = page.stylesheets[i];
            found = false;
            els = document.getElementsByTagName("link");
            for (j = 0, m = els.length; j < m; j++) {
                el = els[j];
                if (el.href === file) {
                    found = true;
                } else if(page.stylesheets.indexOf(el.href) < 0 && app.stylesheets.indexOf(el.href) < 0){
                    el.parentNode.removeChild(el);
                    m = els.length; j--;
                }
            }
            if(!found){
                // Link Tag
                var link = document.createElement("link");
                link.type = "text/css";
                link.rel = "stylesheet";
                link.href = file;
                document.getElementsByTagName("head")[0].appendChild(link);
            }
            
        }
    },

    appendAssets: function(resolve, reject){
        if(typeof resolve === 'function'){
            resolve();
        }
        return;
        //var append = function(rootPath){

        //    // Link Tag
        //    var link = document.createElement("link");
        //    link.type = "text/css";
        //    link.rel = "stylesheet";
        //    link.href = rootPath+"assets/index.css";

        //    // Script tag
        //    var script = document.createElement("script");
        //    script.type = "text/javascript";
        //    script.src = rootPath+"assets/index.js";

        //    // Delete previous link tags
        //    var els = document.getElementsByTagName("link"),
        //      els_length = els.length;
        //    for (var i = 0, l = els_length; i < l; i++) {
        //        var el = els[i];
        //        if (el.href === link.href) {
        //            delete el;
        //        }
        //    }

        //    // Delete previous scripts tags
        //    els = document.getElementsByTagName("script");
        //    els_length = els.length;
        //    for (var i = 0, l = els_length; i < l; i++) {
        //        var el = els[i];
        //        if (el.src === script.src) {
        //            delete el;
        //        }
        //    }

        //    // Reinsert
        //    document.getElementsByTagName("head")[0].appendChild(link);
        //    document.getElementsByTagName("head")[0].appendChild(script);

        //    if(typeof resolve === 'function')
        //        resolve();
        //};

        //if(typeof FileTransfer !== 'undefined' && typeof zip !== 'undefined'){
        //    window.requestFileSystem(LocalFileSystem.TEMPORARY, 0, function (fileSystem) {

        //        // Get fileSystem's relative cache folder
        //        var rootPath = app.rootPath = fileSystem.root.toURL();
        //        append(rootPath);
        //    });
        //} else {
        //    append(DEBUG_WWW_URL);
        //}
    },

    // Application starter
    start: function(resolve, reject){
        if(DEBUG){ console.log('start '+JSON.stringify(app.manifest)); }
        app.utils.setLoadingMsg("Démarrage de l'application");
        app.hasStarted = true;

        /* if there's no footer, fallback to the default */
        if (typeof app.manifest.footer === 'undefined') {
            app.manifest.footer = tmpl('momo-default-footer-tmpl', app.manifest);
        }

        // Default route to home
        app.manifest.id = app.currentPage = 'home';
        
        // Dev page refresh : redirect to home
        window.location.replace('#home');
        // Regiter pages tree
        app.registerPage(app.manifest, app.defaultPage);
    
        // Render Homepage
        app.render(app.manifest);

        // Navigate to home
        app.navigate('home', false, function(){

            // Reset history
            app.pageIndex = 0;

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

            // Cache orginal page
            data.original = JSON.parse(JSON.stringify(data).replace(new RegExp(app.rootPath, 'g'), ""));

            // Extends default page
            data = app.utils.extend(app.defaultPage, data);
            
            // Set page's parent
            data.parent = parentPage;

            // Generate a page ID
            var id = data.id = data.id ? data.id : (data.title ? app.utils.hyphenate(data.title.stripTags()) : '_' + Math.random().toString(36).substr(2, 9));

            // Make sure id is unique
            var i = 0, page;
            while(app.pages.hasOwnProperty(data.id)){
                data.id = id+'_'+(i++).toString();
            }

            // Register page
            app.pages[data.id] = data;

            // Register menu items
            if(data.menu instanceof Array && data.menu.length > 0){
                for(i = 0; i < data.menu.length; i++){
                    page = data.menu[i];
                    if(page instanceof Object){
                        app.pages[data.id].menu[i] = page.id;
                    }
                    app.pages[data.id].menu[i] = app.registerPage(page, app.pages[data.id]);
                }
            } else {
                app.pages[data.id].menu = parentPage.menu || [];
            }
            app.pages[data.id].menu = app.manifest.meta.menu.concat(app.pages[data.id].menu).unique();

            // Register javascript items
            if(data.javascripts instanceof Array && data.javascripts.length > 0){
                app.pages[data.id].javascripts = data.javascripts;
            } else {
                app.pages[data.id].javascripts = parentPage.javascripts || [];
            }
            app.pages[data.id].javascripts = app.manifest.meta.javascripts.concat(app.pages[data.id].javascripts).unique();

            // Register stylesheets items
            if(data.stylesheets instanceof Array && data.stylesheets.length > 0){
                app.pages[data.id].stylesheets = data.stylesheets;
            } else {
                app.pages[data.id].stylesheets = parentPage.stylesheets || [];
            }
            app.pages[data.id].stylesheets = app.manifest.meta.stylesheets.concat(app.pages[data.id].stylesheets).unique();

            // Register hidden pages childrens
            if(data._pages instanceof Array){
                for(i = 0; i < data._pages.length; i++){
                    page = data._pages[i];
                    if(page instanceof Object){
                        app.pages[data.id]._pages[i] = page.id;
                    }
                    app.pages[data.id]._pages[i] = app.registerPage(page, app.pages[data.id]);
                }
            }

            // Register page childrens
            if(data.pages instanceof Array){
                var images = [];
                for(i = 0; i < data.pages.length; i++){
                    page = data.pages[i];
                    if(page instanceof Object){
                        app.pages[data.id].pages[i] = page.id;
                    }
                    page = app.pages[data.id].pages[i] = app.registerPage(page, app.pages[data.id]);
                    if(app.pages[page] && app.pages[page].url && app.pages[page].url.isImage() && !app.pages[page].external){
                        images.push(page);
                    }
                }
                // Build Gallery
                if(images.length){
                    if(images.length > 1 && images[0] === images[images.length - 1]){
                        app.pages[data.id].pages.pop();
                    }
                    for(i = 0; i < images.length; i++){
                        if(i > 0){
                            app.pages[images[i]].prev = images[i-1];
                        }
                        if(i < images.length-1){
                            app.pages[images[i]].next = images[i+1];
                        }
                    }
                }
            }

            // Register seealso childrens
            if(data.seealso instanceof Array){
                for(i = 0; i < data.seealso.length; i++){
                    page = data.seealso[i];
                    if(page instanceof Object){
                        app.pages[data.id].seealso[i] = page.id;
                    }
                    app.pages[data.id].seealso[i] = app.registerPage(page, app.pages[data.id]);
                }
            }

            // Index page for search engine
            app.index.add({
                id: data.id,
                title: data.title,
                body: data.content,
                keywords: data.keywords
            });
            
            // Return ID string
            return data.id;
        } else
        if(typeof data === 'string' || data instanceof String || data instanceof Number){
            // Return ID string
            return data;
        }
    },

    // Render Application
    render: function(data){

        // Render Main section
        var $main = tmpl("momo-main-tmpl", data);
        document.getElementById('momo-main').innerHTML = $main;

        // Render every page
        for(var page in app.pages){
            if(app.pages.hasOwnProperty(page)){
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
        }

    },

    // Render Page
    renderPage: function(page, forceMenu){
        if(page instanceof Object){
            if(DEBUG){ console.log('render page '+JSON.stringify(page)); }

            // Refresh assets
            app.refreshAssets(page);

            // Render every menu items
            document.getElementById('momo-menu').innerHTML = "";


            for(var i = 0, l = page.menu.length; i < l; i++){
                var $menuItem = document.createElement('li');
                var _data = app.utils.extend(app.pages[page.menu[i]], { header: true });
                $menuItem.innerHTML = tmpl("momo-list-item-tmpl", _data);
                document.getElementById('momo-menu').appendChild($menuItem);
            }

            // Render navigation
            if(page.menu !== app.pages[app.currentPage].menu || !app.nav || forceMenu){
                if(app.nav){
                    app.nav.destroy();
                }
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
            // Cleanup
            app.nav.unbindEvents();
            app.nav.bindEvents();

            // Get data to display
            var data = app.utils.extend(page, {meta: app.manifest.meta});

            // Change page header
            document.getElementById("momo-header").innerHTML = tmpl("momo-header-tmpl", data);

            // Render inner template
            if(data.template){
                var script = document.createElement("script");
                script.type = "text/x-tmpl";
                script.id = data.id+"-tmpl";
                script.innerHTML = data.template;
                document.getElementById('momo-templates').innerHTML = "";
                document.getElementById('momo-templates').appendChild(script);
                data.content = tmpl(data.id+"-tmpl", data) + (data.content || "");
            }

            // Render Page
            return tmpl("momo-page-tmpl", data);
        } else
        if(typeof page === 'string' || page instanceof String || page instanceof Number){
            if(DEBUG){ console.log('render page '+page); }
            return app.renderPage(app.pages[page]);
        }
    },

    // Navigate to page
    navigate: function(page, back, cb, force){
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

        var $outpage = document.getElementById(app.currentPage);
        var $inpage  = document.getElementById(page);

        // Render page (with small hack, so it doesn't mess up the display)
        $inpage.innerHTML = app.renderPage(page_obj, force);

        // Pull to update binder
        app.bindPagePull($inpage);

        if(!ANIMATION_ENABLED || app.currentPage === page){
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

            var i;
            var out_classes = (back ? ANIMATION_BACK_OUT_CLASS : ANIMATION_OUT_CLASS).split(' ');
            for(i = 0; i < out_classes.length; i++){
                $outpage.classList.add(out_classes[i]);
            }
            $outpage.addEventListener('animationend',       outCb, false);
            $outpage.addEventListener('webkitAnimationEnd', outCb, false);
            $outpage.addEventListener('oAnimationEnd',      outCb, false);
            $outpage.addEventListener('MSAnimationEnd',     outCb, false);

            $inpage.classList.add('momo-page-current');

            var in_classes = (back ? ANIMATION_BACK_IN_CLASS : ANIMATION_IN_CLASS).split(' ');
            for(i = 0; i < in_classes.length; i++){
                $inpage.classList.add(in_classes[i]);
            }
            $inpage.addEventListener('animationend',       inCb, false);
            $inpage.addEventListener('webkitAnimationEnd', inCb, false);
            $inpage.addEventListener('oAnimationEnd',      inCb, false);
            $inpage.addEventListener('MSAnimationEnd',     inCb, false);
        }

        app.currentPage = page;
    },

    bindPagePull: function($page) {
        WebPullToRefresh.destroy();
        WebPullToRefresh.init( {
            loadingFunction: function(){
                if(ON_PULL === "checkForUpdate"){
                    return new Promise( app.checkForUpdate );
                } else
                if(ON_PULL === "update"){
                    return new Promise( app.update );
                }
            },
            contentEl: $page
        } );
    },

    // Animation Callback
    onAnimationEnd: function($outpage, $inpage, back, cb) {
        app.endCurrPage = false;
        app.endNextPage = false;
        var i;
        var out_classes = (back ? ANIMATION_BACK_OUT_CLASS : ANIMATION_OUT_CLASS).split(' ');
        for(i = 0; i < out_classes.length; i++){
            $outpage.classList.remove(out_classes[i]);
        }
        if($outpage !== $inpage){
            $outpage.classList.remove('momo-page-current');
        }
        var in_classes = (back ? ANIMATION_BACK_IN_CLASS : ANIMATION_IN_CLASS).split(' ');
        for(i = 0; i < in_classes.length; i++){
            $inpage.classList.remove(in_classes[i]);
        }
        app.isAnimating = false;
        if(typeof cb === "function"){
            cb();
        }
    },

    onTouchStart: function(e) {
        e = e || window.event;
        var targ = e.target || e.srcElement;
        if (targ.nodeType === 3){ targ = targ.parentNode; }
        //return targ.onclick();
    },

    // Location Hash change event (sorry & good luck)
    onHashChange: function(e) {
        var hash = window.location.hash, 
            length = window.history.length,
            page = window.location.hash.slice(1),
            prev, next;


        //console.warn(app.previousPage + " -> " + page);

        // Hack of the century ?
        if(app.ignoreHash){ return false; }
        if(document.body.classList.contains( 'ptr-back' )){ return false; }
        if(document.body.classList.contains( 'ptr-forward' )){ return false; }

        if(page === 'momo-update'){
            //window.location.replace('#'+app.pageHistory[app.pageHistory.length-1]);
            window.replaceHash(app.pageHistory[app.pageHistory.length-1]);
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
            app.update(cb, cb);
            app.ignoreHash = true;
            window.history.go(-1);
            app.ignoreHash = false;
            app.previousPage = page;
            return false;
        } else
        if(page === 'momo-blank'){
            //return window.location.replace(app.pageHistory[app.pageHistory.length-1]);
            //return window.history.back();
            app.ignoreHash = true;
            window.history.go(-1);
            app.ignoreHash = false;
            app.previousPage = page;
            return false;
        } 
        else
        if(page === 'momo-back'){
            prev = app.pages[app.currentPage].prev;
            if(prev){
                page = prev;
                window.replaceHash(app.parentPage);
                window.history.go(-1);
                app.navigate(page, true);
                //app.ignoreHash = true;
                //window.location.hash = "#"+page;
                //app.ignoreHash = false;
            } else {
                if(app.previousPage === 'momo-forward'){
                    window.history.go(-1);
                } else {
                    window.history.go(-2);
                }
            }
            //window.replaceHash(page);
            app.previousPage = page;
            return false;
        }
        else
        if(page === 'momo-forward'){
            prev = app.pages[app.currentPage].prev;
            next = app.pages[app.currentPage].next;
            if(next){
                page = next;
                window.replaceHash(app.parentPage);
                window.history.go(-1);
                app.navigate(page, false);
                //window.replaceHash(page);
                //app.ignoreHash = true;
                //window.location.hash = "#"+page;
                //app.ignoreHash = false;
            } else if(prev) {
                window.replaceHash(app.parentPage);
                window.history.go(-1);
            } else {
                if(app.previousPage === 'momo-back'){
                    window.history.go(-1);
                } else {
                    page = app.pageIndex+1 < app.pageHistory.length ? app.pageHistory[app.pageIndex+1] : app.pageHistory[app.pageHistory.length - 1];
                    if(page !== app.currentPage){
                        window.location.hash = "#"+app.pageHistory[app.pageHistory.length-1];
                    } else {
                        window.history.go(-1);
                    }
                }
            }
            //window.replaceHash(page);
            app.previousPage = 'momo-forward';
            return false;
        }

        if(!app.pages.hasOwnProperty(page)){
            page = 'home';
        } 

        var back = page === 'home';

        //console.log(app.pageHistory.join(',')+ " (index = "+app.pageIndex+")");

        if (app.pageHistory.length/* && app.historyLength == length*/) {
            // Goind Back
            if (app.pageHistory[app.pageIndex - 1] === page) {
                //app.pageHistory = app.pageHistory.slice(0, app.pageIndex);
                back = true; 
                app.pageIndex--;
            } else
            // Going Forward
            if(app.pageIndex+1 < app.pageHistory.length && app.pageHistory[app.pageIndex + 1] === page) {
                //app.pageHistory = app.pageHistory.slice(0, app.pageIndex);
                app.pageIndex++;
            } else {
            // Going to new page
            app.pageHistory = app.pageHistory.slice(0, app.pageIndex+1);
            if(page !== app.pageHistory[app.pageHistory.length-1]){
                app.pageHistory.push(page);
            }
            app.pageIndex = app.pageHistory.length - 1;
            app.historyLength = length;
            }
        } else {
            app.pageHistory.push(page);
        }

        if(app.currentPage !== page){
            app.navigate(page, back);
        }
        app.parentPage = page;
        app.previousPage = page;
        return false;
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
        app.pages[id] = app.utils.extend(app.defaultPage, {
            id: id,
            search: query,
            icon: "fa fa-search",
            title: 'Recherche "'+query+'"',
            content: results.length ? null : '<div class="well text-center text-muted">Aucun résultat</div>',
            pages: results.map(function(item){
                return item.ref;
            }),
            menu: app.pages[app.currentPage].menu
        });

        var $page = document.getElementById(id);

        // If search query doesn't exist
        if(!$page){
            // Generate result page view
            $page = document.createElement('div');
            $page.id = id;
            $page.className = "momo-page";
            document.getElementById('momo-pages').appendChild($page);
        }

        // Render page
        $page.innerHTML = app.renderPage(app.pages[id], app.pages[app.currentPage]);

        // Navigate to search result page
        window.location.hash = "#"+id;
    },

    flash: function(message, type) {
        var elements = document.getElementsByClassName("momo-flash-messages");
        var i;
        for (i = 0; i < elements.length; i++){
            elements[i].innerHTML = "";
        }
        setTimeout(function(){
            var elements = document.getElementsByClassName("momo-flash-messages");
            for (i = 0; i < elements.length; i++){
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

        var page, $page;

        for(page in app.pages){
            if(app.pages.hasOwnProperty(page)){
                if(typeof app.pages[page].search === 'undefined'){
                    delete app.pages[page];
                    $page = document.getElementById(page);
                    if($page){
                        $page.parentNode.removeChild($page);
                    }
                }
            }
        }
        // Regiter pages tree
        app.manifest.id = 'home';
        app.registerPage(app.manifest, app.defaultPage);

        // Render every page
        for(page in app.pages){
            if(app.pages.hasOwnProperty(page)){
                $page = document.getElementById(page);
                if(!$page){
                    $page = document.createElement('div');
                    $page.id = app.pages[page].id;
                    $page.className = "momo-page";
                    document.getElementById('momo-pages').appendChild($page);
                }
            }
        }

        // Check for url change in manifest
        //app.checkForUpdate(function(updateAvailable){
        //    if(updateAvailable)
        //        app.update(resolve, reject);
        //    else
                app.utils.setLoadingMsg("Mise à jour effectuée !");
            if(typeof resolve === 'function'){
                resolve();
            }
        //}, function(){
        //    if(typeof reject === 'function')
        //        reject();
        //});

        if(typeof app.pages[app.currentPage].search !== 'undefined'){
            app.search(app.current_query);
        } else {
            app.navigate(app.currentPage, false, null, true);
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
            for (var i = 0; i < elements.length; i++){
                elements[i].innerHTML = text;
            }
        },

        onExternalLinkClick: function(e){
            e = e || window.event;
            var targ = e.target || e.srcElement;
            if (targ.nodeType === 3){ targ = targ.parentNode; }
            var url = targ.getAttribute("href");
            app.utils.openExternalURL(url);
            return false;
        },

        openExternalURL: function(url, inAppBrowser){
            //if(inAppBrowser){
            //    cordova.InAppBrowser.open(url);
            //} else {
                if(navigator.app){ // Android
                    navigator.app.loadUrl(encodeURI(url), { openExternal:true });
                } else { // iOS and others
                    window.open(encodeURI(url), "_system", 'location=yes'); // opens in the app, not in safari
                }
            //}
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
            if (delimeter === null) {
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
            var replaceDuplicates = true;
            var cl, urlhash, sourceUrl;
            if(url.indexOf('#') > 0){
                cl = url.indexOf('#');
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
                    if (!(replaceDuplicates && parameterParts[0] === parameterName))
                    {
                        if (newQueryString === ""){
                            newQueryString = "?";
                        } else {
                            newQueryString += "&";
                        }
                        newQueryString += parameterParts[0] + "=" + (parameterParts[1]?parameterParts[1]:'');
                    }
                }
            }
            if (newQueryString === ""){
                newQueryString = "?";
            }

            if(atStart){
                newQueryString = '?'+ parameterName + "=" + parameterValue + (newQueryString.length>1?'&'+newQueryString.substring(1):'');
            } else {
                if (newQueryString !== "" && newQueryString !== '?'){
                    newQueryString += "&";
                }
                newQueryString += parameterName + "=" + (parameterValue?parameterValue:'');
            }
            return urlParts[0] + newQueryString + urlhash;
        },

        getModifiedTime: function(url, callback) {
            var xhr = new XMLHttpRequest();
            xhr.open('HEAD', url, true); // use HEAD - we only need the headers
            // AJAX Callback
            xhr.onload = function() {

                // AJAX success
                if (xhr.status >= 200 && xhr.status < 400 || xhr.status === 0 /* iOS OhMyBuddha!! */) {
                    var mtime = new Date(xhr.getResponseHeader('Last-Modified'));
                    if (mtime.toString() === 'Invalid Date') {
                      //app.onAjaxError(url);
                      callback(); // dont want to return a bad date
                    } else {
                      callback(mtime);
                    }
                // AJAX error
                } else {
                  //app.onAjaxError(url);
                  callback(); // dont want to return a bad date
                }
            };

            // Handle AJAX Error
            //xhr.onerror = function() {
            //  //app.onAjaxError(url);
            //  callback();
            //};
            xhr.send();
        },

        formatDate: function(date){
            var d = date;
            var months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                          'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
            var days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
            return days[d.getDay()] + ' ' + d.getDate() + ' ' +
                    months[d.getMonth()] + ' ' + d.getFullYear() + ' ' +
                    d.toLocaleTimeString();
        },

        clone: function (obj){
            var copy;
        
            // Handle the 3 simple types, and null or undefined
            if (null === obj || "object" !== typeof obj){ return obj; }
        
            // Handle Date
            if (obj instanceof Date) {
                copy = new Date();
                copy.setTime(obj.getTime());
                return copy;
            }
        
            // Handle Array
            if (obj instanceof Array) {
                copy = [];
                for (var i = 0, len = obj.length; i < len; i++) {
                    copy[i] = app.utils.clone(obj[i]);
                }
                return copy;
            }
        
            // Handle Object
            if (obj instanceof Object) {
                copy = {};
                for (var attr in obj) {
                    if (obj.hasOwnProperty(attr)){ copy[attr] = app.utils.clone(obj[attr]); }
                }
                return copy;
            }
        
            throw new Error("Unable to copy obj! Its type isn't supported.");
        },

        prettyJSON: function(json) {
            if (typeof json !== 'string') {
                 json = JSON.stringify(json, undefined, 2);
            }
            json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            json = json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
                var cls = 'number';
                if (/^"/.test(match)) {
                    if (/:$/.test(match)) {
                        cls = 'key';
                    } else {
                        cls = 'string';
                    }
                } else if (/true|false/.test(match)) {
                    cls = 'boolean';
                } else if (/null/.test(match)) {
                    cls = 'null';
                }
                return '<span class="' + cls + '">' + match + '</span>';
            });
            return '<pre class="code">'+json+'</pre>';
        }
    }
};

(function(namespace) { // Closure to protect local variable "var hash"
    if ('replaceState' in history) { // Yay, supported!
        namespace.replaceHash = function(newhash) {
            if ((''+newhash).charAt(0) !== '#'){ newhash = '#' + newhash; }
            history.replaceState('', '', newhash);
        };
    } else {
        var hash = location.hash;
        namespace.replaceHash = function(newhash) {
            if (location.hash !== hash){ history.back(); }
            location.hash = newhash;
        };
    }
})(window);

if (typeof Object.prototype.toHTML !== 'function') {
    Object.prototype.toHTML = function (){
        return app.utils.prettyJSON(this);
    };
}

if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function (str){
        return this.slice(0, str.length) === str;
    };
}
if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function (str){
        return this.slice(-str.length) === str;
    };
}
if (typeof String.prototype.stripTags !== 'function') {
    String.prototype.stripTags = function (){
        return this.replace(/(<([^>]+)>)/ig,"");
    };
}
if (typeof String.prototype.isImage !== 'function') {
    String.prototype.isImage = function (){
        return this.endsWith('.png') ||
            this.endsWith('.svg') ||
            this.endsWith('.ico') ||
            this.endsWith('.jpeg') ||
            this.endsWith('.jpg');
    };
}
if (typeof String.prototype.isUrl !== 'function') {
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

if (typeof String.prototype.unique !== 'function') {
    Array.prototype.unique = function() {
        var a = this.concat();
        for(var i=0; i<a.length; ++i) {
            for(var j=i+1; j<a.length; ++j) {
                if(a[i] === a[j]){
                    a.splice(j--, 1);
                }
            }
        }
        return a;
    };
}
