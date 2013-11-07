
try {
	var disabled = {}, // local cache, just for speed
		labels = [
			'Disable RWeb indefinitely',
			'DISABLED - Re-enable',
		];

	var menuItemId = chrome.contextMenus.create({
		"title": labels[0],
		"documentUrlPatterns": ['http://*/*', 'https://*/*'],
		"onclick": function(info, tab) {
			if ( !tab.url ) {
				return console.warn('[RWeb] Could not read origin tab URL. Check optional permissions.');
			}

			var host = rweb.host(tab.url);

			if ( host in disabled ) {
				toggleDisabled(disabled, host, tab);
			}
			else {
				chrome.storage.local.get('disabled', function(items) {
					items.disabled || (items.disabled = {});
					toggleDisabled(items.disabled, host, tab);
				});
			}
		}
	});

	function toggleDisabled(cache, host, tab) {
		disabled[host] = !cache[host];
		nowDisabled = disabled[host];

		// Save back into storage.local
		if ( !disabled[host] ) {
			delete disabled[host];
		}
		chrome.storage.local.set({"disabled": disabled}, function() {
			// console.log('Saved new status into storage.local');
		});

		// Update label
		var newLabel = labels[ Number(nowDisabled) ];
		chrome.contextMenus.update(menuItemId, {"title": newLabel});

		// Update tabs, like options.js does & save setting
		chrome.tabs.sendMessage(tab.id, {"rweb": {"disabled": nowDisabled}}, function(rsp) {
			// console.log('Sent new status to origin tab', tab.url, rsp);
		});
	}

	chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
// console.log('tabs.onUpdated');
		if ( info.status && tab.active ) {
			updateLabelStatus(tab);
		}
	});

	chrome.tabs.onHighlighted.addListener(function(info) {
// console.log('tabs.onHighlighted');
		chrome.tabs.get(info.tabIds[0], function(tab) {
			updateLabelStatus(tab);
		});
	});

	function updateLabelStatus(tab) {
		var host = rweb.host(tab.url);

		if ( host in disabled ) {
			updateLabel(disabled, host);
		}
		else {
			chrome.storage.local.get('disabled', function(items) {
				items.disabled || (items.disabled = {});
				updateLabel(items.disabled, host);
			});
		}
	}

	function updateLabel(cache, host) {
		// Update label
		var newLabel = labels[ Number(cache[host]) || 0 ];
		chrome.contextMenus.update(menuItemId, {"title": newLabel});
	}
}
catch (ex) {
	// No permission?
	// DEBUG //
	// throw ex;
	// DEBUG //
}

chrome.browserAction.onClicked.addListener(function(tab) {
	var a = document.createElement('a');
	a.href = tab.url;
	var host = rweb.host(a.host);

	var uri = chrome.extension.getURL('options/options.html');
	rweb.onBrowserActionClick(function(action) {
		if ( action ) {
			uri += '#' + host;
		}
		open(uri);
	});
});

chrome.runtime.onMessage.addListener(function(msg, sender) {
	if ( msg && msg.sites && msg.sites.length ) {
		chrome.browserAction.getBadgeText({tabId: sender.tab.id}, function(text) {
			var num = (parseFloat(text) || 0) + msg.sites.length;
			chrome.browserAction.setBadgeText({
				text: String(num),
				tabId: sender.tab.id
			});
		});

		chrome.browserAction.setBadgeBackgroundColor({
			color: '#000',
			tabId: sender.tab.id
		});
	}
});

chrome.storage.onChanged.addListener(function(changes, area) {
	if (area == 'sync') {
		console.log('[background] onChanged', area, changes);

		chrome.storage.local.set({"lastDownSync": Date.now()});

		// alert('[background] chrome.storage.onChanged: ' + area);
		// alert(JSON.stringify(Object.keys(changes)));
	}
});
