
// try {
	var labels = [
			'Disable RWeb for DOMAIN',
			'Re-enable RWeb for DOMAIN',
		];

	var browserActionMenuItemId = chrome.contextMenus.create({
		"title": labels[0],
		"contexts": ['browser_action'],
		"onclick": function(info, tab) {
			if ( !tab.url ) {
				return console.warn('[RWeb] Could not read origin tab URL. Check optional permissions.');
			}
			var host = rweb.host(tab.url);

			console.time('get & save disabled');
			chrome.storage.local.get('disabled', function(items) {
				var disabled = items.disabled || {};
				toggleDisabled(disabled, host, tab);
			});
		}
	});

	function toggleDisabled(cache, host, tab) {
		cache[host] = !cache[host];
		var nowDisabled = cache[host];

		// Save back into storage.local
		if ( !cache[host] ) {
			delete cache[host];
		}
		chrome.storage.local.set({"disabled": cache}, function() {
			console.timeEnd('get & save disabled');
		});

		// Update label
		var newLabel = labels[ Number(nowDisabled) ];
		updateLabel(nowDisabled, host, tab.id);

		// Update tabs, like options.js does & save setting
		chrome.tabs.sendMessage(tab.id, {"rweb": {"disabled": nowDisabled}}, function(rsp) {
			// console.log('Sent new status to origin tab', tab.url, rsp);
		});
	}

	chrome.tabs.onUpdated.addListener(function(tabId, info, tab) {
		// console.log('onUpdated', tabId, info, tab);
		if ( info.status && tab.active ) {
			updateLabelStatus(tab);
		}
	});

	chrome.tabs.onActivated.addListener(function(info) {
		// console.log('onActivated', info);
		chrome.tabs.get(info.tabId, function(tab) {
			updateLabelStatus(tab);
		});
	});

	chrome.windows.onFocusChanged.addListener(function(windowId) {
		chrome.windows.get(windowId, {"populate": true}, function(window) {
			var e = chrome.runtime.lastError; // Stut up, Chrome
			if ( !window ) return;
			// console.log('onFocusChanged', windowId, window);

			for ( var i=window.tabs.length-1; i>=0; i-- ) {
				var tab = window.tabs[i];
				if ( tab.active ) {
					updateLabelStatus(tab);
					break;
				}
			};
		});
	});

	function updateLabelStatus(tab) {
		var host = rweb.host(tab.url);

		chrome.storage.local.get('disabled', function(items) {
			var disabled = items.disabled || {};
			updateLabel(host in disabled, host, tab.id);
		});
	}

	function updateLabel(disabled, host, tabId) {
		// Update label
		var newLabel = labels[ Number(disabled) ].replace('DOMAIN', host);
		chrome.contextMenus.update(browserActionMenuItemId, {"title": newLabel});

		// Update badge
		if ( disabled ) {
			// Show X on red
			chrome.browserAction.setBadgeBackgroundColor({
				color: [255, 0, 0, 255], // red
				tabId: tabId,
			});
			chrome.browserAction.setBadgeText({
				text: 'x',
				tabId: tabId,
			});
		}
		else {
			// Hide X
			chrome.browserAction.setBadgeText({
				text: '',
				tabId: tabId,
			});
		}
	}
// }
// catch (ex) {
	// No permission?
	// DEBUG //
	// throw ex;
	// DEBUG //
// }

chrome.browserAction.onClicked.addListener(function(tab) {
	var a = document.createElement('a');
	a.href = tab.url;
	var host = rweb.host(a.host);

	var uri = chrome.extension.getURL('options/options.html');
	uri += '#' + host;
	open(uri);
});

var optionsClosedTimer;

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	// Content script matched site
	if ( msg && msg.site ) {
		chrome.browserAction.getBadgeText({tabId: sender.tab.id}, function(text) {
			var num = (parseFloat(text) || 0) + 1;
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

	// Forced auto-download from content script
	if ( msg && msg.forceAutoDownload ) {
		rweb.sync.download(function(summary) {
			rweb.log('download', true, summary.changes, function() {
				// Log saved
			});

			// This one doesn't reach the content script for some reason... Too async?
			sendResponse(summary);
		}, true);
	}

	// Options page closed
	if ( msg && msg.optionsClosed ) {
		optionsClosedTimer = setTimeout(function() {
			console.log('Uploading automatically, because options page closed');
			rweb.sync.upload(function(summary) {
				var changes = !summary.dirty ? 0 : null;
				rweb.log('upload', true, changes, function() {
					// Log saved
				});

				// Done
				console.log('Automatic upload done');
			}, true);
		}, 1000);
	}

	// Options page opened
	if ( msg && msg.optionsOpened ) {
		clearTimeout(optionsClosedTimer);
	}
});
