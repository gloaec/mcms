var WebPullToRefresh = (function () {
	'use strict';

	/**
	 * Hold all of the default parameters for the module
	 * @type {object}
	 */	
	var defaults = {
		// ID of the element holding pannable content area
		contentEl: 'content', 

		// ID of the element holding pull to refresh loading area
		ptrEl: 'ptr', 

		// Number of pixels of panning until refresh 
		distanceToRefresh: 70, 
		distanceToBack: 20, 
		distanceToForward: 20, 

		// Pointer to function that does the loading and returns a promise
		loadingFunction: false,

		// Dragging resistance level
		resistance: 2.5
	};

	/**
	 * Hold all of the merged parameter and default module options
	 * @type {object}
	 */
	var options = {};

	/**
	 * Pan event parameters
	 * @type {object}
	 */
	var pan = {
		enabled: false,
		distance: 0,
		startingPositionY: 0,
        distanceRight: 0,
        distanceLeft: 0
	};
	
	/**
	 * Easy shortener for handling adding and removing body classes.
	 */
	var bodyClass = document.body.classList;
	
	/**
	 * Initialize pull to refresh, hammer, and bind pan events.
	 * 
	 * @param {object=} params - Setup parameters for pull to refresh
	 */
	var init = function( params ) {
		params = params || {};
		options = {
			contentEl: params.contentEl || document.getElementById( defaults.contentEl ),
			ptrEl: params.ptrEl || document.getElementById( defaults.ptrEl ),
			distanceToRefresh: params.distanceToRefresh || defaults.distanceToRefresh,
			distanceToBack: params.distanceToBack || defaults.distanceToBack,
			distanceToForward: params.distanceToBack || defaults.distanceToForward,
			loadingFunction: params.loadingFunction || defaults.loadingFunction,
			resistance: params.resistance || defaults.resistance
		};

		if ( ! options.contentEl || ! options.ptrEl ) {
			return false;
		}

        var iframes = options.contentEl.getElementsByTagName('iframe');
        var overlays = options.contentEl.getElementsByClassName('momo-frame-overlay');
        var wrappers = options.contentEl.getElementsByClassName('momo-frame-wrapper');

        if(iframes.length > 0) {
            options.iframe = iframes[0];
            options.overlay = overlays[0];
            options.wrapper = wrappers[0];
            // FIXME; Touch events on iframe (IMPOZZZZIBLE !!!)
            //options.overlay.addEventListener('touchstart', _onTouchStart);
            //options.overlay.addEventListener('touchend', _onTouchEnd);
        }

		options.h = new Hammer( options.contentEl, { touchAction: 'auto' } );

		options.h.get( 'pan' ).set( { direction: Hammer.DIRECTION_ALL } );

		options.h.on( 'pandown panstart', _panStart );
		options.h.on( 'pandown', _panDown );
		options.h.on( 'panup', _panUp );
		options.h.on( 'panright', _panRight );
		options.h.on( 'panleft', _panLeft );
		options.h.on( 'panend', _panEnd );
	};

    var destroy = function() {
        if(options.h)
            options.h.destroy();
    };

    var sendTouchEvent = function(element, eventType, touchList) {
        var touchEvent = document.createEvent("TouchEvent");

        var canBubble = true;
        var cancelable = true;
        var view = window;
        var detail = null;    // not sure what this is
        var screenX = 0;
        var screenY = 0;
        var clientX = 0;
        var clientY = 0;
        var ctrlKey = false;
        var altKey = false;
        var shiftKey = false;
        var metaKey = false;
        var touches = touchList;
        var targetTouches = touchList;
        var changedTouches = touchList;
        var scale = 1;
        var rotation = 0;

        if (false /*browser.usesAndroidInitTouchEventParameterOrder()*/) {
            touchEvent.initTouchEvent(
                touches, targetTouches, changedTouches,
                eventType,
                view,
                screenX, screenY,
                clientX, clientY,
                ctrlKey, altKey, shiftKey, metaKey
            );
        }
        else {
            touchEvent.initTouchEvent(
                eventType,
                canBubble,
                cancelable,
                view,
                detail,
                screenX, screenY,
                clientX, clientY,
                ctrlKey, altKey, shiftKey, metaKey,
                touches, targetTouches, changedTouches,
                scale, rotation
            );
        }

        var eventData = new jQuery.Event("event");
        eventData.type = eventType;
        eventData.originalEvent = touchEvent;
        $(element).trigger(eventData);
    };

    var _onTouchStart = function(e){
        bodyClass.add( 'disable-overlay' );
        //e.preventDefault();
        //e.stopImmediatePropagation();
        var _e = TouchEvent.create(e);
        app.utils.extend(_e, {
          originalEvent : {
            touches: e.touches,
            changedTouches: e.changedTouches,
            targetTouches: e.targetTouches,
            pageX: e.pageX,
            pageY: e.pageY
          }
        });
        options.overlay.removeEventListener('touchstart', _onTouchStart);
        //options.iframe.dispatchEvent(_e);
        try {
        sendTouchEvent(options.iframe.contentWindow, 'touchstart', e.targetTouches);
        } catch(e) {}
        options.overlay.addEventListener('touchstart', _onTouchStart);
    };

    var _onTouchEnd = function(e){
        //e.preventDefault();
        //e.stopImmediatePropagation();
        var _e = TouchEvent.create(e);
        _e.touches = e.touches;
        _e.changedTouches = e.changedTouches;
        _e.targetTouches = e.targetTouches;
        _e.pageX = e.pageX;
        _e.pageY = e.pageY;
        options.overlay.removeEventListener('touchend', _onTouchEnd);
        //options.iframe.dispatchEvent(_e);
        try {
        sendTouchEvent(options.iframe.contentWindow, 'touchend', e.targetTouches);
        } catch(e) {}
        options.overlay.addEventListener('touchend', _onTouchEnd);
        bodyClass.remove( 'disable-overlay' );
    };

	/**
	 * Determine whether pan events should apply based on scroll position on panstart
	 * 
	 * @param {object} e - Event object
	 */
	var _panStart = function(e) {
		pan.startingPositionY = options.contentEl.scrollTop;

		if ( pan.startingPositionY === 0 ) {
			pan.enabled = true;
		} else {
            pan.enabled = false;
        }
	};

	/**
	 * Handle element on screen movement when the pandown events is firing.
	 * 
	 * @param {object} e - Event object
	 */
	var _panDown = function(e) {
		if ( ! pan.enabled ) {
			return true;
		}

		e.preventDefault();
		pan.distance = e.distance / options.resistance;

		_setContentPan();
		_setBodyClass();
	};


	/**
	 * Handle element on screen movement when the pandown events is firing.
	 * 
	 * @param {object} e - Event object
	 */
	var _panUp = function(e) {
		if ( ! pan.enabled || pan.distance === 0 ) {
			return true;
		}

		e.preventDefault();

		if ( pan.distance < e.distance / options.resistance ) {
			pan.distance = 0;
		} else {
			pan.distance = e.distance / options.resistance;
		}
		_setContentPan();
		_setBodyClass();
	};

	var _panRight = function(e) {

		e.preventDefault();
		pan.distanceRight = e.distance / options.resistance;

		if ( pan.distanceLeft < e.distance / options.resistance ) {
			pan.distanceLeft = 0;
		} else {
			pan.distanceLeft = e.distance / options.resistance;
		}

		_setBodyClass();
	};

	var _panLeft = function(e) {

		e.preventDefault();
		pan.distanceLeft = e.distance / options.resistance;

		if ( pan.distanceRight < e.distance / options.resistance ) {
			pan.distanceRight = 0;
		} else {
			pan.distanceRight = e.distance / options.resistance;
		}

		_setBodyClass();
	};

	/**
	 * Set the CSS transform on the content element to move it on the screen.
	 */
	var _setContentPan = function() {
		// Use transforms to smoothly animate elements on desktop and mobile devices
		//options.contentEl.style.transform = options.contentEl.style.webkitTransform = 'translate3d( 0, ' + pan.distance + 'px, 0 )';
		//options.ptrEl.style.transform = options.ptrEl.style.webkitTransform = 'translate3d( 0, ' + ( pan.distance - options.ptrEl.offsetHeight ) + 'px, 0 )';
        options.contentEl.style.top = (60 + pan.distance) + 'px';
        options.ptrEl.style.top = (60 + pan.distance - options.ptrEl.offsetHeight) + 'px';
	};

	/**
	 * Set/remove the loading body class to show or hide the loading indicator after pull down.
	 */
	var _setBodyClass = function() {
		if ( pan.distanceRight > options.distanceToBack ) {
			bodyClass.add( 'ptr-back' );
        } else {
			bodyClass.remove( 'ptr-back' );
        }
		if ( pan.distanceLeft > options.distanceToForward ) {
			bodyClass.add( 'ptr-forward' );
        } else {
			bodyClass.remove( 'ptr-forward' );
        }
		if ( pan.distance > options.distanceToRefresh ) {
			bodyClass.add( 'ptr-refresh' );
		} else {
		    bodyClass.add( 'ptr-pulling' );
			bodyClass.remove( 'ptr-refresh' );
		}		
	};

	/**
	 * Determine how to animate and position elements when the panend event fires.
	 * 
	 * @param {object} e - Event object
	 */
	var _panEnd = function(e) {
		e.preventDefault();

		//options.contentEl.style.transform = options.contentEl.style.webkitTransform = '';
		//options.ptrEl.style.transform = options.ptrEl.style.webkitTransform = '';
        options.contentEl.style.top = "";//"110px";
        options.ptrEl.style.top = "";//60px";
		bodyClass.remove( 'ptr-pulling' );

		pan.distance = 0;
		pan.distanceRight = 0;
		pan.distanceLeft = 0;
		pan.enabled = false;

		if ( document.body.classList.contains( 'ptr-refresh' ) ) {
			_doLoading();
        } else if ( document.body.classList.contains( 'ptr-back' ) ) {
            _doBack();
        } else if ( document.body.classList.contains( 'ptr-forward' ) ) {
            _doForward();
		} else {
			_doReset();
		}
	};

	/**
	 * Position content and refresh elements to show that loading is taking place.
	 */
	var _doLoading = function() {
		bodyClass.add( 'ptr-loading' );

		// If no valid loading function exists, just reset elements
		if (typeof options.loadingFunction != 'function') {
			return _doReset();
		}

		// The loading function should return a promise
		var loadingPromise = options.loadingFunction();

		// For UX continuity, make sure we show loading for at least one second before resetting
		setTimeout( function() {
			// Once actual loading is complete, reset pull to refresh
			loadingPromise.then( _doReset );
		}, 1000 );
	};

    var _doBack = function() {
        window.history.back();
        _doReset();
    };

    var _doForward = function() {
        window.history.forward();
        _doReset();
    };

	/**
	 * Reset all elements to their starting positions before any paning took place.
	 */
	var _doReset = function() {
		bodyClass.remove( 'ptr-loading' );
		bodyClass.remove( 'ptr-back' );
		bodyClass.remove( 'ptr-forward' );
		bodyClass.remove( 'ptr-pulling' );
		bodyClass.remove( 'ptr-refresh' );
		bodyClass.add( 'ptr-reset' );
      
        setTimeout(function(){
		    bodyClass.remove( 'ptr-reset' );
        }, 250);

        //transitionEnd(options.contentEl).bind(function(){
		//    bodyClass.remove( 'ptr-reset' );
        //    transitionEnd(options.contentEl).unbind();
        //});

		//var bodyClassRemove = function() {
		//	options.contentEl.removeEventListener( 'transitionend', bodyClassRemove, false );
		//};

		//options.contentEl.addEventListener( 'transitionend', bodyClassRemove, false );
	};

	return {
		init: init,
        destroy: destroy
	}

})();
