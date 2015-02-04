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
var app = {

    pages: {},

    // Application Constructor
    initialize: function() {
        this.bindEvents();
        this.loadManifest();
    },
    
    loadManifest: function(){
        console.log("Loading Manifest");
        var manifest = localStorage.getItem("momo-manifest");
        var manifestUrl = manifest ? manifest['updateUrl'] : 'index.json';
        var request = new XMLHttpRequest();
        request.open('GET', manifestUrl, true);
        request.onload = function() {
          if (request.status >= 200 && request.status < 400) {
            var data = JSON.parse(request.responseText);
            app.registerPage(data, true);
            app.render(data);
          } else {
            alert("Error "+request.status);
          }
        };
        request.onerror = function() {
          alert("Connexion Error");
        };
        request.send();
    },

    registerPage: function(data, homepage){
        if(data instanceof Object){
            var id = data.id ? data.id : (homepage ? 'home' : '_' + Math.random().toString(36).substr(2, 9));
            app.pages[id] = data;
            if(data.pages instanceof Array){
                for(var i = 0; i < data.pages.length; i++){
                    var page = data.pages[i];
                    app.pages[id].pages[i] = app.registerPage(page, false);
                }
            }
            if(data.seealso instanceof Array){
                for(var i = 0; i < data.seealso.length; i++){
                    var page = data.seealso[i];
                    app.pages[id].seealso[i] = app.registerPage(page, false);
                }
            }
            return id;
        } else
        if(typeof data === 'string' || data instanceof String || data instanceof Number){
            return data;
        }
    },

    render: function(data){
        app.utils.updateEl('.momo-title', data.meta.title);
        app.utils.updateEl('.momo-icon', '<img src="'+data.meta.icon+'" width="20px" height="20px"/>');
        app.renderPage(data);
    },

    renderPage: function(page){

        if(page instanceof Object){
            if(page.external){
                navigator.app.loadUrl(page.url, { openExternal:true });
                return false;
            }
            app.utils.updateEl('.momo-page-content', '');
            app.utils.updateEl('.momo-page-pages', '');
            app.utils.updateEl('.momo-page-seealso', '');
            app.utils.updateEl('.momo-page-title', page.title);
            var $seealso = document.querySelector('.momo-page-seealso');
            $seealso.parentElement.style.display = 'none';

            if(page.content){
                app.utils.updateEl('.momo-page-content', page.content);
            } else
            if(page.url){
                app.utils.updateEl('.momo-page-content', '<iframe src="'+page.url+'"></iframe>');
            }          
            if(page.pages instanceof Array){
                app.utils.updateEl('.momo-page-pages', app.utils.renderLinks(page.pages));
            }
            if(page.seealso instanceof Array){
                $seealso.parentElement.style.display = 'block';
                app.utils.updateEl('.momo-page-seealso', app.utils.renderLinks(page.seealso));
            }
        } else
        if(typeof page === 'string' || page instanceof String || page instanceof Number){
            console.log('Render page '+page);
            window.location.hash = page;
            if(app.pages.hasOwnProperty(page)) {
                app.renderPage(app.pages[page]);
            } else {
                alert('Page "'+page+'" doesn\'t exist');
            }
        }
    },

    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
        window.addEventListener('hashchange', this.onHashChange, false);
    },

    onHashChange: function(e) {
        var page = window.location.hash.slice(1);
        if(!page){
            page = app.pages['home']
        } 
        app.renderPage(page);
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
        }
    }
};
