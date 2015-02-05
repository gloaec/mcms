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

var ANIMATION_OUT_CLASS  = 'pt-page-moveToLeftEasing pt-page-ontop';
var ANIMATION_IN_CLASS = 'pt-page-moveFromRight';
var ANIMATION_BACK_OUT_CLASS  = 'pt-page-moveToRightEasing pt-page-ontop';
var ANIMATION_BACK_IN_CLASS = 'pt-page-moveFromLeft';

var extend = function ( defaults, options ) {
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
};

var app = {

    pages: {},

    meta: {
        'title': 'Momo Application',
        'contact': 'contact@cadoles.com'
    },

    current       : 0,
    isAnimating   : false,
    endCurrPage   : false,
    endNextPage   : false,
    hashHistory   : [window.location.hash],
    historyLength : window.history.length,

    // Application Constructor
    initialize: function() {
        this.bindEvents();
        this.loadManifest();
    },
    
    // JSON Manifest loading function
    loadManifest: function(){
        var manifest    = localStorage.getItem("momo-manifest");
        var manifestUrl = manifest ? manifest['updateUrl'] : 'index.json';
        var request     = new XMLHttpRequest();
        request.open('GET', manifestUrl, true);
        request.onload = function() {
            if (request.status >= 200 && request.status < 400) {
                var data = JSON.parse(request.responseText);
                app.start(data);
            } else {
                alert("Error "+request.status);
            }
        };
        request.onerror = function() {
            alert("Connexion Error");
        };
        request.send();
    },


    // Application starter
    start: function(data){
        data.id = 'home';
        app.current_page = data.id;
        app.registerPage(data);
        app.render(data);
        //app.navigate(data.id);
    },

    // Recursive function to index page form json
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
            return tmpl("momo-page-tmpl", page);
        } else
        if(typeof page === 'string' || page instanceof String || page instanceof Number){
            return app.renderPage(app.pages[page]);
        }
    },

    navigate: function(page, back){

        var page_obj = app.pages[page];
        console.log('navigate');
        console.log(app.renderPage(app.pages[page]));
        if(page_obj.external){
            navigator.app.loadUrl(page_obj.url, { openExternal:true });
            return false;
        }

        if(app.isAnimating) {
            return false;
        }

        app.isAnimating = true;

        var $outpage = document.getElementById(app.current_page);
        var $inpage  = document.getElementById(page);

        //$inpage.classList.add('momo-page-current');
        //$outpage.classList.remove('momo-page-current');

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

        app.current_page = page;
    },

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

    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        window.addEventListener('hashchange', this.onHashChange, false);
    },

     
    onHashChange: function(e) {
        var hash = window.location.hash, length = window.history.length;
        var page = window.location.hash.slice(1);
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

        if(!app.pages.hasOwnProperty(page)){
            page = 'home';
        } 

        if(app.current_page != page){
            app.navigate(page, back);
        }
    },

    onDeviceReady: function() {
        app.receivedEvent('deviceready');
    },

    receivedEvent: function(id) {
        console.log('Received Event: ' + id);
    },

    utils: {

        updateEl: function(selector, html){
            var $el = document.querySelectorAll(selector);
            for (var i = 0; i < $el.length; i++)
              $el[i].innerHTML = html;
        },

        renderLinks: function(links){
            var html = "";
            for(var i = 0; i < links.length; i++){
                var link = links[i];
                var page = app.pages[link];
                html += '<a href="#'+link+'" ';
                html += 'class="list-group-item" >';
                html += app.pages[link].title;
                html += '</a>';
            }
            return html;
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
