var TouchEvent = (function() {
    
    var ua = /iPhone|iP[oa]d/.test(navigator.userAgent) ? 'iOS' : /Android/.test(navigator.userAgent) ? 'Android' : 'PC';
    
    //document.addEventListener('DOMContentLoaded', function(event) {
    //    
    //    if(ua === 'PC') {
    //        return;
    //    }
    //    
    //    document.addEventListener('touchstart', function() {
    //        console.log('Touch!');
    //    }, false);
    //    
    //    var touchEvent = create();
    //    
    //    setTimeout(function() {
    //        document.dispatchEvent(touchEvent);
    //    }, 3000);
    //    
    //}, false);
    
    function create(option) {
        var option = option || {};
        var param = {
            type: 'touchstart',
            canBubble: true,
            cancelable: true,
            view: window,
            detail: 0,
            screenX: 0,
            screenY: 0,
            clientX: 0,
            clientY: 0,
            ctrlKey: false,
            altKey: false,
            shiftKey: false,
            metaKey: false,
            touches: 0,
            targetTouches: 0,
            changedTouches: 0,
            scale: 0,
            rotation: 0,
            touchItem: 0
        };

        var event = document.createEvent('TouchEvent');
        
        for(var i in param) {
            if(param.hasOwnProperty(i)) {
                param[i] = option[i] !== undefined ? option[i] : param[i];
            }
        }
        
        if(ua === 'Android') {
            event.initUIEvent(param.touchItem, param.touchItem, param.touchItem, param.type, param.view, param.screenX, param.screenY, param.clientX, param.clientY, param.ctrlKey, param.altKey, param.shiftKey, param.metaKey);
        } else {
            event.initUIEvent(param.type, param.canBubble, param.cancelable, param.view, param.detail, param.screenX, param.screenY, param.clientX, param.clientY, param.ctrlKey, param.altKey, param.shiftKey, param.metaKey, param.touches, param.targetTouches, param.changedTouches, param.scale, param.rotation);
        }
        
        return event;
    }

    return {
        create: create
    }
    
})();
