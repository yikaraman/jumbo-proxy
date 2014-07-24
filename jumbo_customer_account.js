
/**
 * Wraps the jumbo account
 *
 * @param {string} id The form's DOM ID.
 * @constructor
 */
var JumboCustomerAccount = function() {

  /**
   * Global variable containing the unique token for the extension installation.
   * It is initially fetched from the back-end and stored for later use.
   *
   * @type {string}
   * @private
   */
  this.token_ = null;

  /**
   * Global variable containing the password for the token
   *
   * @type {string}
   * @private
   */
  this.password_ = null;

  /**
   * Global variable containing current proxy list.
   * It is regularly fetched from the back-end and stored for later use.
   *
   * @type {string}
   * @private
   */
  this.proxyList_ = null;

  /**
   * Global variable containing the previously selected proxy ID
   *
   * @type {string}
   * @private
   */
  this.proxyID_ = null;

  /**
   * Back-end script URL that will generate an unique token
   * 
   * @type {string}
   * @private
   */
  this.tokenURL_ = 'https://www.jumbroxy.com/backend/token.php';

  /**
   * Back-end script URL that will generate a proxy list
   * 
   * @type {string}
   * @private
   */
  this.proxyListURL_ = 'https://www.jumbroxy.com/backend/prxlst.php?token=';
};

///////////////////////////////////////////////////////////////////////////////

JumboCustomerAccount.prototype = {

  /**
  * Request the unique token from the backend server
  * and save it in the local storage
  */
  requestToken : function() {

    console.log('Requesting token URL ' + this.tokenURL_);

    var req = new XMLHttpRequest();
    req.open("GET", this.tokenURL_, true);
    req.onload = this.setToken_.bind(this);
    req.onerror = this.setTokenAlarm_.bind();
    req.send(null);
  },


  /**
   * Handle the 'onerror' event of our token XHR request, generated in
   * 'requestToken'
   *
   * @param {ProgressEvent} e The XHR ProgressEvent.
   * @private
   */
  setTokenAlarm_ : function() {

    console.log('Token URL request failed, setting alarm');

    /* Set alaram to repeat token request in 1 minute */
    chrome.alarms.create("RequestTokenAlarm", { delayInMinutes: 1 });
  },

  /**
   * Handle the 'onload' event of our token XHR request, generated in
   * 'requestToken'
   *
   * @param {ProgressEvent} e The XHR ProgressEvent.
   * @private
   */
  setToken_ : function (e) {

    /* Check the response code */
    if( e.target.status != "200") {

      /* If not 200, repeat the token request */
      this.setTokenAlarm_();
    } else {
    
    /* We handle the returned value as a text string. */
    /* Use XML instead? */
    result = JSON.parse( e.target.responseText);
    this.token_ = result.token;
    this.password_ = result.password;

    console.log('Saving token to local storage ' + this.token_);

    window.localStorage['jumboToken'] = JSON.stringify(this.token_);
    window.localStorage['password'] = JSON.stringify(this.password_);

    /*
     * Fetch the proxy list once the token has been received
     */
    this.requestProxyList();
    }
  },

  /**
   * Fetch the token from the local storage
   */
  fetchToken_ : function() {

    var result = null;
    if (window.localStorage['jumboToken'] !== undefined) {
      result = JSON.parse(window.localStorage['jumboToken']);
      this.token_ = result;
    }

    console.log('Fetching token from local storage ' + this.token_);

    return this.token_ ? this.token_ : null;
  },

  /**
   * Return the token value
   */
  getToken : function() {
    return this.token_ ? this.token_ : this.fetchToken_();
  },

  /**
   * Fetch the proxy IP from the local storage
   */
  fetchProxyID_ : function() {

    var result = null;
    if (window.localStorage['manualProxyID'] !== undefined) {
      result = JSON.parse(window.localStorage['manualProxyID']);
      this.proxyID_ = result;
    }

    console.log('Fetching Proxy ID from local storage ' + this.proxyID_);

    return this.proxyID_ ? this.proxyID_ : null;
  },

  /**
   * Return the Proxy ID value
   */
  getProxyID : function() {
    return this.proxyID_ ? this.proxyID_ : this.fetchProxyID_();
  },

  constructProxyListURL_: function () {
    return this.proxyListURL_ + encodeURIComponent( this.getToken()) 
	+ '&proxyid=' + encodeURIComponent( this.getProxyID());
  },

  /**
   * Sends an XHR GET request to grab available proxies from the database. The
   * XHR's 'onload' event is hooks up to the 'setProxyList_' method. The
   * XHR's 'onerror' event is hooks up to the 'showError_' method.
   *
   * We actually need to POST to that URL
   *
   * @public
   */
  requestProxyList: function() {
    var req = new XMLHttpRequest();
    req.open("GET", this.constructProxyListURL_(), true);
    req.onload = this.setProxyList_.bind(this);
/*    req.onerror = this.showError_.bind(this);*/
    req.send(null);
  },

  /**
   * Handle the 'onload' event of our proxyList XHR request, generated in
   * 'requestProxyList', by saving the data in local storage
   *
   * @param {ProgressEvent} e The XHR ProgressEvent.
   * @private
   */
  setProxyList_: function (e) {

    /* Check the response code */
    if( e.target.status != "200") {

      console.log('Fetching proxylist failed');

      if( e.target.status == "400") {

        console.log('Reinitialization required');

        // Requesting new token
        this.requestToken();

      }
    } else {

    /* We handle the returned value as a text string. */
    /* Use XML instead? */
    var json = e.target.responseText;
    result = JSON.parse( json);
    this.proxyList_ = result;

    console.log('Saving proxy list to local storage');

    // Save to the local storage
    window.localStorage['proxyList'] = json;

    // Show the proxy list in the form
//    this.showProxyList();
    this.showProxyStacks();
    }
  },

  /**
   * Fetch the proxy list from the local storage
   */
  fetchProxyList_ : function() {

    var result = null;
    if (window.localStorage['proxyList'] !== undefined) {
      result = JSON.parse(window.localStorage['proxyList']);
      this.proxyList_ = result;
    }

    console.log('Fetching proxy list from local storage');

    return this.proxyList_ ? this.proxyList_ : null;
  },

  /**
   * Return the proxy list value
   */
  getProxyList : function() {
    return this.proxyList_ ? this.proxyList_ : this.fetchProxyList_();
  },

  /**
   *
   * Updates the manualProxies select with available options
   *
   * @param
   * @private
   */
  showProxyList: function() {

    // The control to be updated
    var select = document.getElementById('manualProxies');

    // Only proceed if the select is not null
    if( select) {

    // Get the proxy list
    result = this.getProxyList();
    console.log('proxylist length ' + result.length);
    if( !result || result.length == 0) {

	// Put some dummy text to inform the proxy list is not available
	var spanMissing = document.createElement('span');
        spanMissing.id = 'manualProxiesMissing';
	spanMissing.innerHTML = 'The proxy list has not been loaded yet. Click Reload icon.<br/>';
	select.parentNode.appendChild( spanMissing);
    } 
    else {

      // Remove the proxy list missing message if present
      var spanMissing = document.getElementById('manualProxiesMissing');
      if( spanMissing) {
        spanMissing.parentNode.removeChild( spanMissing);
      }

      // We need to remove any available items of the select first
      while( select.firstChild) {
        select.removeChild( select.firstChild);
      }

      // Go through all the available items and populate select
      for (var key in result) {
        if (result.hasOwnProperty(key)) {
          var id = result[key].id;
          var host = result[key].host;
          var port = result[key].port;
          var status = result[key].status;
          var country = result[key].country;
          var DMA = result[key].DMA;

          var option = document.createElement('option');
          option.id = 'manualProxy' + id;
          option.value = id;
          option.innerHTML = '' + country + ',&nbsp;' + DMA;

          // We hide the DMAs without hostname
          if( host == '') {
            option.disabled = 'disabled';
          }

          console.log('Populating the select ' + option.innerHTML);

          select.appendChild(option);
        }
      }
    }
    }
  },

  /**
   *
   * Updates the manual-proxy section with available options
   *
   * @param
   * @private
   */
  showProxyStacks: function() {

    // The control to be updated
    var select = document.getElementById('proxy-list');

    // Only proceed if the select is not null
    if( select) {

    // Get the proxy list
    result = this.getProxyList();
    console.log('proxylist length ' + result.length);
    if( !result || result.length == 0) {

      // Remove the proxy list missing message if present
      var spanMissing = document.getElementById('manualProxiesMissing');
      if( spanMissing) {
        spanMissing.parentNode.removeChild( spanMissing);
      }

	// Put some dummy text to inform the proxy list is not available
	var spanMissing = document.createElement('span');
        spanMissing.id = 'manualProxiesMissing';
	spanMissing.innerHTML = 'The proxy list is empty or has not been loaded yet. Press Reload button in a few minutes.<br/>';
	select.appendChild( spanMissing);
    } 
    else {

      // Remove the proxy list missing message if present
      var spanMissing = document.getElementById('manualProxiesMissing');
      if( spanMissing) {
        spanMissing.parentNode.removeChild( spanMissing);
      }

      // We need to remove any available items of the select first
      while( select.firstChild) {
        select.removeChild( select.firstChild);
      }

	// Main proxy list containing all the data
	var proxyList = [ {
					identifier: 'american-proxies',
					description: 'American proxies',
//					currentlySelectedIdentifier: 'american-proxy-one',
					servers: [],
				},
			{
					identifier: 'english-proxies',
					description: 'English proxies',
//					currentlySelectedIdentifier: 'english-proxy-one',
					servers: [],
				}
			];


      // Go through all the available items and populate select
      for (var key in result) {
        if (result.hasOwnProperty(key)) {
          var id = result[key].id;
          var host = result[key].host;
          var port = result[key].port;
          var status = result[key].status;
          var country = result[key].country;
          var DMA = result[key].DMA;

	if( country == 'US') {
		proxyList[0].servers.push({identifier:'us-proxy-' + id,description:country + ' proxy: ' + DMA});
//		proxyList[0].servers[id].identifier = 'us-proxy-' + id;
//		proxyList[0].servers[id].description = country + ' proxy: ' + DMA;
	} else if ( country == 'UK') {
		proxyList[1].servers.push({identifier:'uk-proxy-' + id,description:country + ' proxy: ' + DMA});
//		proxyList[1].servers.push(id);
//		proxyList[1].servers[id].identifier = 'uk-proxy' + id;
//		proxyList[1].servers[id].description = country + ' proxy: ' + DMA;
	}


/*
          var option = document.createElement('option');
          option.id = 'manualProxy' + id;
          option.value = id;
          option.innerHTML = '' + country + ',&nbsp;' + DMA;

          // We hide the DMAs without hostname, i.e. not available for free users
          if( host == '') {
            option.disabled = 'disabled';
          }

          console.log('Populating the select ' + option.innerHTML);

          select.appendChild(option);
*/
        }
      }

	this.populateProxyLists( proxyList);

	this.pingServers();
    }
    }
  },

	// ping available servers
	pingServers: function() {

  // check if the show ping times has been enabled
  if( (window.localStorage['showPingTimes'] !== undefined) 
	&& JSON.parse(window.localStorage['showPingTimes'])) {

    // Get the proxy list
    result = this.getProxyList();

      // Go through all the available items and populate select
      for (var key in result) {
        if (result.hasOwnProperty(key)) {
          var id = result[key].id;
          var host = result[key].host;
          var port = result[key].port;
          var status = result[key].status;
          var country = result[key].country;
          var DMA = result[key].DMA;

          var pingTime = 123;

/*
var startTime;
$.ajax({
	url: 'http://531151672.r.worldcdn.net/r15lgc.js?v='+Math.random(),
    beforeSend: function(){
        startTime = new Date();
    },
    complete: function(jqXHR, textStatus){
        pingTime = (new Date()) - startTime;
    }

});

*/

function createCallback( proxy_country, proxy_id, request_start) {
    return function() {
      var end = new Date().getTime();
      pingTime = end - request_start;
      var button = document.getElementById('manual-' + proxy_country.toLowerCase() + '-proxy-' + proxy_id);
      if( request_start)
	  button.innerHTML = button.innerHTML + "<span style='float:right;font-size:8pt;color:#a33'>" + pingTime + "ms</span>";
      else
	  button.innerHTML = button.innerHTML + "<span style='float:right;font-size:8pt;color:#a33'>error</span>";	
    };
}

var start = new Date().getTime();
var xhr = new XMLHttpRequest();
// SQUID always give 400 error
// "http://" + host + ":" + port
xhr.open("GET", "http://" + host + ":" + port, true); // false = syncroneous request
//xhr.setRequestHeader('country', country);
//xhr.setRequestHeader('id', id);

xhr.onload = createCallback( country, id, start);
xhr.onerror = createCallback( country, id, false);
/*
xhr.onreadystatechange = function() {
//  if (xhr.readyState == 4) {
    var end = new Date().getTime();
	pingTime = end - start;

	  var button = document.getElementById('manual-' + country.toLowerCase() + '-proxy-' + id);
	  button.innerHTML = button.innerHTML + "<span style='float:right;font-size:8pt;color:#a33'>" + pingTime + "ms</span>";
//  }
}
*/
//try {
xhr.send();
/*
} catch (exception) {
  console.log('Can not fetch ' + "http://" + host + ":" + port);
	  var button = document.getElementById('manual-' + country.toLowerCase() + '-proxy-' + id);
	  button.innerHTML = button.innerHTML + "<span style='float:right;font-size:8pt;color:#a33'>...</span>";
}
*/
// throw exception;

          console.log('Updating ping times for ' + 'manual-' + country.toLowerCase() + '-proxy-' + id);

        }
      }
  }
	},


	// function to populate proxy stacks
		 populateProxyLists: function(locations) {
			var proxyList = document.getElementById('proxy-list');
			// empty the list first
			while (proxyList.lastChild) {
				proxyList.removeChild(proxyList.lastChild);
			}

		var deselectConnectionTypes = function() {
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
		};

			// button click handling
			var handleProxyButton = function(proxy, button, location, listItem) {
				// only update display if setting proxy succeeds
//				if (setProxy(proxy) && setConnectionType(connectionTypes.Proxy)) {
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
//				}
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
//			var currentProxy = getProxy();
			var currentProxy = this.fetchProxyID_();
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
					button.setAttribute('id', 'manual-' + locations[i].servers[j].identifier );
          				console.log('currentProxy ' + currentProxy + ' ID ' + locations[i].servers[j].identifier);
					if (locations[i].servers[j].identifier.indexOf( '-' + currentProxy) > 0) {
// No need to check connection type since currentProxy is null if Direct/System is selected
//					if (currentProxy === locations[i].servers[j].identifier && getConnectionType() === connectionTypes.Proxy) {
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
				// If no servers avalable, do not show the country
				if( locations[i].servers.length) {
				if (!serverSelected) {
					firstServerItem.setAttribute('class', ' selected');
				}
				location.appendChild(serverList);
				var expandButton = document.createElement('button');
				expandButton.setAttribute('class', 'expansionButton');
				expandButton.setAttribute('id', 'expansion-' + locations[i].identifier);
				expandFactory(proxyList, serverList, expandButton);
				location.appendChild(expandButton);
				proxyList.appendChild(location);
				}
			}
		},

};

