/**
 * Dragdealer JS v0.9.5
 * http://code.ovidiu.ch/dragdealer-js
 *
 * Copyright (c) 2010, Ovidiu Chereches
 * MIT License
 * http://legal.ovidiu.ch/licenses/MIT
 */

/* Cursor */

var Cursor =
{
	x: 0, y: 0,
	init: function()
	{
		this.setEvent('mouse');
		this.setEvent('touch');
	},
	setEvent: function(type)
	{
		var moveHandler = document['on' + type + 'move'] || function(){};
		document['on' + type + 'move'] = function(e)
		{
			moveHandler(e);
			Cursor.refresh(e);
		}
	},
	refresh: function(e)
	{
		if(!e)
		{
			e = window.event;
		}
		if(e.type == 'mousemove')
		{
			this.set(e);
		}
		else if(e.touches)
		{
			this.set(e.touches[0]);
		}
	},
	set: function(e)
	{
		if(e.pageX || e.pageY)
		{
			this.x = e.pageX;
			this.y = e.pageY;
		}
		else if(e.clientX || e.clientY)
		{
			this.x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
			this.y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
		}
	}
};
Cursor.init();

/* Position */

var Position =
{
	get: function(obj)
	{
		var curleft = curtop = 0;
		if(obj.offsetParent)
		{
			do
			{
				curleft += obj.offsetLeft;
				curtop += obj.offsetTop;
			}
			while((obj = obj.offsetParent));
		}
		return [curleft, curtop];
	}
};

/* Dragdealer */

var Dragdealer = function(wrapper, options)
{
	if(typeof(wrapper) == 'string')
	{
		wrapper = document.getElementById(wrapper);
	}
	if(!wrapper)
	{
		return;
	}
	var handle = wrapper.getElementsByTagName('div')[0];
	if(!handle || handle.className.search(/(^|\s)handle(\s|$)/) == -1)
	{
		return;
	}
	this.init(wrapper, handle, options || {});
	this.setup();
};
Dragdealer.prototype =
{
	init: function(wrapper, handle, options)
	{
		this.wrapper = wrapper;
		this.handle = handle;
		this.options = options;
		
		this.disabled = this.getOption('disabled', false);
		this.horizontal = this.getOption('horizontal', true);
		this.vertical = this.getOption('vertical', false);
		this.slide = this.getOption('slide', true);
		this.steps = this.getOption('steps', 0);
		this.snap = this.getOption('snap', false);
		this.loose = this.getOption('loose', false);
		this.speed = this.getOption('speed', 10) / 100;
		this.xPrecision = this.getOption('xPrecision', 0);
		this.yPrecision = this.getOption('yPrecision', 0);
		
		this.callback = options.callback || null;
		this.animationCallback = options.animationCallback || null;
		
		this.bounds = {
			left: options.left || 0, right: -(options.right || 0),
			top: options.top || 0, bottom: -(options.bottom || 0),
			x0: 0, x1: 0, xRange: 0,
			y0: 0, y1: 0, yRange: 0
		};
		this.value = {
			prev: [-1, -1],
			current: [options.x || 0, options.y || 0],
			target: [options.x || 0, options.y || 0]
		};
		this.offset = {
			wrapper: [0, 0],
			mouse: [0, 0],
			prev: [-999999, -999999],
			current: [0, 0],
			target: [0, 0]
		};
		this.change = [0, 0];
		
		this.activity = false;
		this.dragging = false;
		this.tapping = false;
	},
	getOption: function(name, defaultValue)
	{
		return this.options[name] !== undefined ? this.options[name] : defaultValue;
	},
	setup: function()
	{
		this.setWrapperOffset();
		this.setBoundsPadding();
		this.setBounds();
		this.setSteps();
		
		this.addListeners();
	},
	setWrapperOffset: function()
	{
		this.offset.wrapper = Position.get(this.wrapper);
	},
	setBoundsPadding: function()
	{
		if(!this.bounds.left && !this.bounds.right)
		{
			this.bounds.left = Position.get(this.handle)[0] - this.offset.wrapper[0] - this.getOption('handleOffset', 0);
			this.bounds.right = -this.bounds.left;
		}
		if(!this.bounds.top && !this.bounds.bottom)
		{
			this.bounds.top = Position.get(this.handle)[1] - this.offset.wrapper[1];
			this.bounds.bottom = -this.bounds.top;
		}
	},
	setBounds: function()
	{
		this.bounds.x0 = this.bounds.left;
		this.bounds.x1 = this.wrapper.offsetWidth + this.bounds.right;
		this.bounds.xRange = (this.bounds.x1 - this.bounds.x0) - (this.getOption('containHandle', true) ? this.handle.offsetWidth : 0);
		
		this.bounds.y0 = this.bounds.top;
		this.bounds.y1 = this.wrapper.offsetHeight + this.bounds.bottom;
		this.bounds.yRange = (this.bounds.y1 - this.bounds.y0) - this.handle.offsetHeight;
		
		this.bounds.xStep = 1 / (this.xPrecision || Math.max(this.wrapper.offsetWidth, this.handle.offsetWidth));
		this.bounds.yStep = 1 / (this.yPrecision || Math.max(this.wrapper.offsetHeight, this.handle.offsetHeight));
	},
	setSteps: function()
	{
		if(this.steps > 1)
		{
			this.stepRatios = [];
			for(var i = 0; i <= this.steps - 1; i++)
			{
				this.stepRatios[i] = i / (this.steps - 1);
			}
		}
	},
	addListeners: function()
	{
		var self = this;
		
		this.wrapper.onselectstart = function()
		{
			return false;
		}
		this.handle.onmousedown = this.handle.ontouchstart = function(e)
		{
			self.handleDownHandler(e);
		};
		this.wrapper.onmousedown = this.wrapper.ontouchstart = function(e)
		{
			self.wrapperDownHandler(e);
		};
		var mouseUpHandler = document.onmouseup || function(){};
		document.onmouseup = function(e)
		{
			mouseUpHandler(e);
			self.documentUpHandler(e);
		};
		var touchEndHandler = document.ontouchend || function(){};
		document.ontouchend = function(e)
		{
			touchEndHandler(e);
			self.documentUpHandler(e);
		};
		var resizeHandler = window.onresize || function(){};
		window.onresize = function(e)
		{
			resizeHandler(e);
			self.documentResizeHandler(e);
		};
		this.wrapper.onmousemove = function(e)
		{
			self.activity = true;
		}
		this.wrapper.onclick = function(e)
		{
			return !self.activity;
		}
		
		this.interval = setInterval(function(){ self.animate() }, 25);
		self.animate(false, true);
	},
	handleDownHandler: function(e)
	{
		this.activity = false;
		Cursor.refresh(e);
		
		this.preventDefaults(e, true);
		this.startDrag();
		this.cancelEvent(e);
	},
	wrapperDownHandler: function(e)
	{
		Cursor.refresh(e);
		
		this.preventDefaults(e, true);
		this.startTap();
	},
	documentUpHandler: function(e)
	{
		this.stopDrag();
		this.stopTap();
		//this.cancelEvent(e);
	},
	documentResizeHandler: function(e)
	{
		this.setWrapperOffset();
		this.setBounds();
		
		this.update();
	},
	enable: function()
	{
		this.disabled = false;
		this.handle.className = this.handle.className.replace(/\s?disabled/g, '');
	},
	disable: function()
	{
		this.disabled = true;
		this.handle.className += ' disabled';
	},
	setStep: function(x, y, snap)
	{
		this.setValue(
			this.steps && x > 1 ? (x - 1) / (this.steps - 1) : 0,
			this.steps && y > 1 ? (y - 1) / (this.steps - 1) : 0,
			snap
		);
	},
	setValue: function(x, y, snap)
	{
		this.setTargetValue([x, y || 0]);
		if(snap)
		{
			this.groupCopy(this.value.current, this.value.target);
		}
	},
	startTap: function(target)
	{
		if(this.disabled)
		{
			return;
		}
		this.tapping = true;
		
		if(target === undefined)
		{
			target = [
				Cursor.x - this.offset.wrapper[0] - (this.handle.offsetWidth / 2),
				Cursor.y - this.offset.wrapper[1] - (this.handle.offsetHeight / 2)
			];
		}
		this.setTargetOffset(target);
	},
	stopTap: function()
	{
		if(this.disabled || !this.tapping)
		{
			return;
		}
		this.tapping = false;
		
		this.setTargetValue(this.value.current);
		this.result();
	},
	startDrag: function()
	{
		if(this.disabled)
		{
			return;
		}
		this.offset.mouse = [
			Cursor.x - Position.get(this.handle)[0],
			Cursor.y - Position.get(this.handle)[1]
		];
		
		this.dragging = true;
	},
	stopDrag: function()
	{
		if(this.disabled || !this.dragging)
		{
			return;
		}
		this.dragging = false;
		
		var target = this.groupClone(this.value.current);
		if(this.slide)
		{
			var ratioChange = this.change;
			target[0] += ratioChange[0] * 4;
			target[1] += ratioChange[1] * 4;
		}
		this.setTargetValue(target);
		this.result();
	},
	feedback: function()
	{
		var value = this.value.current;
		if(this.snap && this.steps > 1)
		{
			value = this.getClosestSteps(value);
		}
		if(!this.groupCompare(value, this.value.prev))
		{
			if(typeof(this.animationCallback) == 'function')
			{
				this.animationCallback(value[0], value[1]);
			}
			this.groupCopy(this.value.prev, value);
		}
	},
	result: function()
	{
		if(typeof(this.callback) == 'function')
		{
			this.callback(this.value.target[0], this.value.target[1]);
		}
	},
	animate: function(direct, first)
	{
		if(direct && !this.dragging)
		{
			return;
		}
		if(this.dragging)
		{
			var prevTarget = this.groupClone(this.value.target);
			
			var offset = [
				Cursor.x - this.offset.wrapper[0] - this.offset.mouse[0],
				Cursor.y - this.offset.wrapper[1] - this.offset.mouse[1]
			];
			this.setTargetOffset(offset, this.loose);
			
			this.change = [
				this.value.target[0] - prevTarget[0],
				this.value.target[1] - prevTarget[1]
			];
		}
		if(this.dragging || first)
		{
			this.groupCopy(this.value.current, this.value.target);
		}
		if(this.dragging || this.glide() || first)
		{
			this.update();
			this.feedback();
		}
	},
	glide: function()
	{
		var diff = [
			this.value.target[0] - this.value.current[0],
			this.value.target[1] - this.value.current[1]
		];
		if(!diff[0] && !diff[1])
		{
			return false;
		}
		if(Math.abs(diff[0]) > this.bounds.xStep || Math.abs(diff[1]) > this.bounds.yStep)
		{
			this.value.current[0] += diff[0] * this.speed;
			this.value.current[1] += diff[1] * this.speed;
		}
		else
		{
			this.groupCopy(this.value.current, this.value.target);
		}
		return true;
	},
	update: function()
	{
		if(!this.snap)
		{
			this.offset.current = this.getOffsetsByRatios(this.value.current);
		}
		else
		{
			this.offset.current = this.getOffsetsByRatios(
				this.getClosestSteps(this.value.current)
			);
		}
		this.show();
	},
	show: function()
	{
		if(!this.groupCompare(this.offset.current, this.offset.prev))
		{
			if(this.horizontal)
			{
				this.handle.style.left = String(this.offset.current[0]) + 'px';
			}
			if(this.vertical)
			{
				this.handle.style.top = String(this.offset.current[1]) + 'px';
			}
			this.groupCopy(this.offset.prev, this.offset.current);
		}
	},
	setTargetValue: function(value, loose)
	{
		var target = loose ? this.getLooseValue(value) : this.getProperValue(value);
		
		this.groupCopy(this.value.target, target);
		this.offset.target = this.getOffsetsByRatios(target);
	},
	setTargetOffset: function(offset, loose)
	{
		var value = this.getRatiosByOffsets(offset);
		var target = loose ? this.getLooseValue(value) : this.getProperValue(value);
		
		this.groupCopy(this.value.target, target);
		this.offset.target = this.getOffsetsByRatios(target);
	},
	getLooseValue: function(value)
	{
		var proper = this.getProperValue(value);
		return [
			proper[0] + ((value[0] - proper[0]) / 4),
			proper[1] + ((value[1] - proper[1]) / 4)
		];
	},
	getProperValue: function(value)
	{
		var proper = this.groupClone(value);

		proper[0] = Math.max(proper[0], 0);
		proper[1] = Math.max(proper[1], 0);
		proper[0] = Math.min(proper[0], 1);
		proper[1] = Math.min(proper[1], 1);
		
		if((!this.dragging && !this.tapping) || this.snap)
		{
			if(this.steps > 1)
			{
				proper = this.getClosestSteps(proper);
			}
		}
		return proper;
	},
	getRatiosByOffsets: function(group)
	{
		return [
			this.getRatioByOffset(group[0], this.bounds.xRange, this.bounds.x0),
			this.getRatioByOffset(group[1], this.bounds.yRange, this.bounds.y0)
		];
	},
	getRatioByOffset: function(offset, range, padding)
	{
		return range ? (offset - padding) / range : 0;
	},
	getOffsetsByRatios: function(group)
	{
		return [
			this.getOffsetByRatio(group[0], this.bounds.xRange, this.bounds.x0),
			this.getOffsetByRatio(group[1], this.bounds.yRange, this.bounds.y0)
		];
	},
	getOffsetByRatio: function(ratio, range, padding)
	{
		return Math.round(ratio * range) + padding;
	},
	getClosestSteps: function(group)
	{
		return [
			this.getClosestStep(group[0]),
			this.getClosestStep(group[1])
		];
	},
	getClosestStep: function(value)
	{
		var k = 0;
		var min = 1;
		for(var i = 0; i <= this.steps - 1; i++)
		{
			if(Math.abs(this.stepRatios[i] - value) < min)
			{
				min = Math.abs(this.stepRatios[i] - value);
				k = i;
			}
		}
		return this.stepRatios[k];
	},
	groupCompare: function(a, b)
	{
		return a[0] == b[0] && a[1] == b[1];
	},
	groupCopy: function(a, b)
	{
		a[0] = b[0];
		a[1] = b[1];
	},
	groupClone: function(a)
	{
		return [a[0], a[1]];
	},
	preventDefaults: function(e, selection)
	{
		if(!e)
		{
			e = window.event;
		}
		if(e.preventDefault)
		{
			e.preventDefault();
		}
		e.returnValue = false;
		
		if(selection && document.selection)
		{
			document.selection.empty();
		}
	},
	cancelEvent: function(e)
	{
		if(!e)
		{
			e = window.event;
		}
		if(e.stopPropagation)
		{
			e.stopPropagation();
		}
		e.cancelBubble = true;
	}
};


window.onload = function() {
	// anonymous function to avoid polluting global namespace
	(function() {
		// static identifiers
		var connectionTypes = {
			Direct: 0,
			System: 1,
			Proxy: 2
		}
		// variables to be deleted when functions below are properly implemented
		var tempProxyVar = 'english-proxy-three';
		var tempShowPingsVar = false;
		var tempConnectionType = connectionTypes.Direct;
		/*******************  Functions to be implemented *********************/
		// function to set current proxy
		function setProxy(proxy) {
			tempProxyVar = proxy;
			return true;
		}
		// function to get current proxy
		function getProxy() {
			return tempProxyVar;
		}
		// function to set connection type (@param connectionType property)
		function setConnectionType(connectionType) {
			tempConnectionType = connectionType;
			return true;
		}
		// function to get connection type
		function getConnectionType() {
			return tempConnectionType;
		}
		// set the auto-rotation time
		function setAutoRotation(value) {

			window.localStorage['rotationInterval'] = value;

			/* Set alarm at specified interval */
			if (value > 0) {

    // Set alarm for proxy rotation
    var persistedSettings = ProxyFormController.getPersistedSettings();
    var rotationInterval = JSON.parse(window.localStorage['rotationInterval']);
    if (persistedSettings.regular.mode == 'fixed_servers' && rotationInterval > 0) {

	console.log('Resetting proxy rotation interval: ' + rotationInterval);

        /* Set alaram to repeat proxy rotation */
// No need to clear the previous alarm since it will be replaced with the new one
//	chrome.alarms.clear("RotateProxyAlarm");
        chrome.alarms.create("RotateProxyAlarm", { delayInMinutes: rotationInterval, periodInMinutes: rotationInterval });
    }
			} else {
				/* Clear alarm if rotation has been disabled) */
				chrome.alarms.clear("RotateProxyAlarm");
			}
			return true;
		}
		// get the current auto-rotation time
		function getAutoRotation() {

			if( window.localStorage['rotationInterval'] > 0) {
				return JSON.parse(window.localStorage['rotationInterval']);
			}

			// Switched off by default
			return -3;
		}
		// get whether to show ping times
		function getShowPingTimes() {

			if( window.localStorage['showPingTimes'] !== undefined) {
				return JSON.parse(window.localStorage['showPingTimes']);
			}
			
			return false;
		}
		// get whether to show ping times
		function setShowPingTimes(value) {

			window.localStorage['showPingTimes'] = value;
			return true;
		}
		// get the unique token for the user
		function getUniqueToken() {
			return JSON.parse(window.localStorage['jumboToken']);
		}
		// submit user support request
		function submitSupportRequest(data) {
//			console.log(data);

			var URL_ = "https://www.jumbroxy.com/backend/request.php";
			var params = "token=" + encodeURIComponent( data['token']);
			if( data['email'].length > 0) {
				params = params + '&email=' + encodeURIComponent( data['email']);
			}
			if( data['message'].length > 0) {
				params = params + '&message=' + encodeURIComponent( data['message']);
			}

			console.log('URL: ' + URL_ + ' params: ' + params);

			var req = new XMLHttpRequest();
			req.open("POST", URL_, true);
			req.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')

//    req.onload = this.setProxyList_.bind(this);
//    req.onerror = this.showError_.bind(this);
			req.send(params);

// Notification about message sent
    var success = document.createElement('div');
    success.textContent = "Request sent";
    document.body.appendChild(success);

		}
		// function to load proxy lists
		function loadProxyLists() {
/*
			return [
				{
					identifier: 'american-proxies',
					description: 'American proxies',
					currentlySelectedIdentifier: 'american-proxy-three',
					servers: [
						{
							identifier: 'american-proxy-one',
							description: 'US proxy: Los Angeles, Ca1',
						},
						{
							identifier: 'american-proxy-two',
							description: 'US proxy: Los Angeles, Ca2',
						},
						{
							identifier: 'american-proxy-three',
							description: 'US proxy: Los Angeles, Ca3',
						},
						{
							identifier: 'american-proxy-four',
							description: 'US proxy: Los Angeles, Ca4',
						}
					]
				},
				{
					identifier: 'english-proxies',
					description: 'English proxies',
					currentlySelectedIdentifier: 'english-proxy-three',
					servers: [
						{
							identifier: 'english-proxy-one',
							description: 'UK proxy: London1',
						},
						{
							identifier: 'english-proxy-two',
							description: 'UK proxy: London2',
						},
						{
							identifier: 'english-proxy-three',
							description: 'UK proxy: London3',
						},
						{
							identifier: 'english-proxy-four',
							description: 'UK proxy: London4',
						}
					]
				}
			];
*/
		}
		/*******************  End of functions to be implemented *********************/
		function deselectConnectionTypes() {
			// deactivate all other items (proxies, connection types...)
			deactivateItems = document.querySelectorAll('#proxy-tab .active');
			for (var i = 0; i < deactivateItems.length; i++) {
				var cssClass = deactivateItems[i].getAttribute('class');
				deactivateItems[i].setAttribute('class', (cssClass === null ? '' : cssClass.replace(' active', '')));
			}
			// re-enable any disabled buttons
			disabledItems = document.querySelectorAll('#proxy-tab button');
			for (var i = 0; i < disabledItems.length; i++) {
				disabledItems[i].removeAttribute('disabled');
			}
			// close lists
			var lists = document.querySelectorAll('.proxy-locations.open');
			for (var i = 0; i < lists.length; i++) {
				lists[i].setAttribute('class', lists[i].getAttribute('class').replace(' open', ''));
			}
		}
		// function to populate proxy lists
		function populateProxyLists(locations) {
			var proxyList = document.getElementById('proxy-list');
			// empty the list first
			while (proxyList.lastChild) {
				proxyList.removeChild(proxyList.lastChild);
			}
			// button click handling
			var handleProxyButton = function(proxy, button, location, listItem) {
				// only update display if setting proxy succeeds
				if (setProxy(proxy) && setConnectionType(connectionTypes.Proxy)) {
					deselectConnectionTypes();
	    			// deselect any other server items in the list
	    			var serverItems = location.querySelectorAll('.selected');
	    			for (var i = 0; i < serverItems.length; i++) {
	    				cssClass = serverItems[i].getAttribute('class');
	    				serverItems[i].setAttribute('class', (cssClass === null ? '' : cssClass.replace(' selected', '')));
					}
	    			// select and activate the proxy server item
	    			cssClass = listItem.getAttribute('class');
					listItem.setAttribute('class', (cssClass === null ? '' : cssClass.replace(' active', '').replace(' selected', '')) + ' active selected');
				}
		    };
		    // function factory to cope with closures
		    var buttonClickFactory = function(proxy, button, location, listItem) {
		    	button.onclick = function() {
		    		handleProxyButton(proxy, this, location, listItem);
		    	};
		    };
		    // list handle function
		    var expandFactory = function(parentList, childList, button) {
		    	button.onclick = function() {
		    		if (~childList.getAttribute('class').indexOf('open')) {
		    			var cssClass = childList.getAttribute('class');
		    			childList.setAttribute('class', ((cssClass === null ? '' : cssClass.replace(' open', ''))));
		    		}
		    		else {
			    		// loop through all lists, closing any open ones and opening the button's parent list
		    			var lists = parentList.querySelectorAll('ul.open');
						for (var i = 0; i < lists.length; i++) {
							lists[i].setAttribute('class', lists[i].getAttribute('class').replace(' open', ''));
						}
						var cssClass = childList.getAttribute('class');
						childList.setAttribute('class', ((cssClass === null ? '' : cssClass.replace(' open', '')) + ' open'));
		    		}
		    	};
		    };
		    // get current proxy so that we can set it as active in the lists
			var currentProxy = getProxy();
			// create a list for each proxy location item
		    for (var i = 0; i < locations.length; i++) {
				var location = document.createElement('li');
				var flag = document.createElement('img');
				// assume that there is a file named after the location identifier, giving the location flag
				flag.setAttribute('src', locations[i].identifier + '.svg');
				flag.setAttribute('alt', locations[i].description + ' flag');
				flag.setAttribute('class', 'proxy-flag');
				location.appendChild(flag);
				var serverList = document.createElement('ul');
				serverList.setAttribute('class', 'proxy-locations');
				var firstServerItem = null;
				var serverSelected = false;
				// loop through all servers in the location, adding them to the list
				for (var j = 0; j < locations[i].servers.length; j++) {
					var server = document.createElement('li');
					if (firstServerItem === null) {
						firstServerItem = server;
					}
					var button = document.createElement('button');
					button.setAttribute('class', 'button');
					if (currentProxy === locations[i].servers[j].identifier && getConnectionType() === connectionTypes.Proxy) {
						server.setAttribute('class', ' active selected');
						button.setAttribute('disabled', 'disabled');
						serverSelected = true;
					}
					// add click handler to button
					buttonClickFactory(locations[i].servers[j].identifier, button, serverList, server);
					var description = document.createTextNode(locations[i].servers[j].description);
					button.appendChild(description);
					server.appendChild(button);
					serverList.appendChild(server);
				}
				if (!serverSelected) {
					firstServerItem.setAttribute('class', ' selected');
				}
				location.appendChild(serverList);
				var expandButton = document.createElement('button');
				expandButton.setAttribute('class', 'expansionButton');
				expandFactory(proxyList, serverList, expandButton);
				location.appendChild(expandButton);
				proxyList.appendChild(location);
			}
		}
		// add click handling for direct connection button, and activate if necessary
		var directConnection = document.getElementById('direct-connection-button');
		directConnection.onclick = function() {
			if (setConnectionType(connectionTypes.Direct)) {
				deselectConnectionTypes();
				cssClass = this.getAttribute('class');
				this.setAttribute('class', (cssClass === null ? '' : cssClass.replace(' active', '')) + ' active');
			}
		}
		if (getConnectionType() === connectionTypes.Direct) {
			cssClass = directConnection.getAttribute('class');
			directConnection.setAttribute('class', (cssClass === null ? '' : cssClass.replace(' active', '')) + ' active');
		}
		// add click handling for system connection button, and activate if necessary
		var systemConnection = document.getElementById('system-wide-button');
		systemConnection.onclick = function() {
			if (setConnectionType(connectionTypes.System)) {
				deselectConnectionTypes();
				cssClass = this.getAttribute('class');
				this.setAttribute('class', (cssClass === null ? '' : cssClass.replace(' active', '')) + ' active');
			}
		}
		if (getConnectionType() === connectionTypes.System) {
			cssClass = systemConnection.getAttribute('class');
			systemConnection.setAttribute('class', (cssClass === null ? '' : cssClass.replace(' active', '')) + ' active');
		}
	  // get tab container
	  var container = document.getElementById('tab-container');
	    //store which tab we are on
	  var tabButtons = container.querySelectorAll('.tab-buttons > li > button');
	    for (var i = 0; i < tabButtons.length; i++) {
	      tabButtons[i].onclick = displayPage;
	    }
	    
	    var tabs = container.querySelectorAll('.tabs > li')
	    var sliderInited = false;
	    function displayPage() {
	    		// switch to the selected tab
			  var current = this.parentNode.getAttribute('data-target');
			  for (var i = 0; i < tabButtons.length; i++) {
				  tabButtons[i].parentNode.removeAttribute('class');
			  }
			  this.parentNode.setAttribute('class','active');
			  for (var i = 0; i < tabs.length; i++) {
				  tabs[i].removeAttribute('class');
			  }
			  document.getElementById(current).setAttribute('class', 'active');
			  // initialise the slider when we open it's tab (only the first time)
			  if (sliderInited === false && Dragdealer !== undefined) {
			  	var slider = new Dragdealer('rotation',
					  {
			  			// there are 4 fake steps which account for the large space at the start of the slider
				  		steps: 24,
				  		snap: true,
						slide: false,
					  	callback: function(x, y) {
					  		// if the step is one of our fake steps, then set steps to zero
					  		if (x <= (4 / 24)) {
					  			this.setStep(0);
								setAutoRotation(0);
					  		}
							else {
								// send integer step value as auto-rotation time
								setAutoRotation(Math.round(Math.max(0, (this.getClosestStep(x) * 23) - 3)));
							}
					  	},
						// additional options added to original DragDealer source, to not take into account the 
				  		// width of the slider handle when calculating position and bounds
				  		containHandle: false,
						handleOffset: -11
				});
			  	// get current auto-rotation value and initialise slider with it
				slider.setStep(getAutoRotation() + 4);
			  sliderInited = true;
	    	}
		}
	    // set handling for show ping times button
	    var showPings = document.getElementById('show-ping-times');
	    showPings.onclick = function() {
			var  value = showPings.getAttribute('class') === 'active';
	    	if (setShowPingTimes(!value)) {
				if (value) {
			    	showPings.removeAttribute('class');
			    }
			    else {
			    	showPings.setAttribute('class', 'active');
			    }
			}
	    };
	    // Chrome seems to filter the click from top elements
	    var pingElements = showPings.querySelectorAll('*');
	    for (var i = 0; i < pingElements.length; i++) {
	    	pingElements.onclick = showPings.onclick;
	    }
		var reloadProxies = function() {
//			var newProxyList = loadProxyLists();
//			populateProxyLists(newProxyList);
		}
		// add proxy reload button handling
		var proxiesButton = document.getElementById('reload-proxies');
		if (proxiesButton !== null) {
			proxiesButton.onclick = reloadProxies;
		}
		// get initial value for show ping times
		if (getShowPingTimes()) {
			showPings.setAttribute('class', 'active');
		}
		// get initial value for unique token
		document.getElementById('token').setAttribute('value', getUniqueToken());
		// add form submit handling for support request
		document.getElementById('support-form').onsubmit = function() {
			submitSupportRequest({
				'token': document.getElementById('token').value,
				'email': document.getElementById('email').value,
				'message': document.getElementById('message').value
			});
			return false;
		}
		// initial load of proxies list
//		reloadProxies();
	})();
};
