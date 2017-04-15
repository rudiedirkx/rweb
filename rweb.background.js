
// try {
	var labels = [
			'Disable RWeb for DOMAIN',
			'Re-enable RWeb for DOMAIN',
		];

	var browserActionMenuItemId = rweb.browser.contextMenus.create({
		"title": labels[0],
		"contexts": ['browser_action'],
		"onclick": function(info, tab) {
			if ( !tab.url ) {
				return console.warn('[RWeb] Could not read origin tab URL. Check optional permissions.');
			}
			var host = rweb.host(tab.url);

			console.time('get & save disabled');
			rweb.browser.storage.local.get('disabled', function(items) {
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
		rweb.browser.storage.local.set({"disabled": cache}, function() {
			console.timeEnd('get & save disabled');
		});

		// Update label
		var newLabel = labels[ Number(nowDisabled) ];
		updateLabel(nowDisabled, host, tab.id);

		// Update tabs, like options.js does
		function updateTabs(css) {
			var message = {"rweb": {"disabled": nowDisabled, "css": css}};
			rweb.browser.tabs.query({}, function(tabs) {
				tabs.forEach(function(tab) {
					var tabHost = rweb.host(tab.url);

					// Only EXACT matches, no wildcards etc
					if ( tabHost == host ) {
						rweb.browser.tabs.sendMessage(tab.id, message, function(rsp) {
							// console.log('Sent new status to origin tab', tab.url, rsp);
						});
					}
				});
			});
		}

		// Immediately send the disable command
		if ( nowDisabled ) {
			updateTabs('');
		}

		// Collect live CSS, because the page might be loaded disabled
		else {
			rweb.site(host, function(site) {
				if ( site && site.css ) {
					updateTabs(site.css);
				}
			});
		}
	}

	rweb.browser.tabs.onUpdated.addListener(function(tabId, info, tab) {
		// console.log('onUpdated', tabId, info, tab);
		if ( info.status && tab.active ) {
			updateLabelStatus(tab);
		}
	});

	rweb.browser.tabs.onActivated.addListener(function(info) {
		// console.log('onActivated', info);
		rweb.browser.tabs.get(info.tabId, function(tab) {
			updateLabelStatus(tab);
		});
	});

	rweb.browser.windows.onFocusChanged.addListener(function(windowId) {
		rweb.browser.windows.get(windowId, {"populate": true}, function(window) {
			var e = rweb.browser.runtime.lastError; // Shut up, Chrome
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

		rweb.browser.storage.local.get('disabled', function(items) {
			var disabled = items.disabled || {};
			updateLabel(host in disabled, host, tab.id);
		});
	}

	function updateLabel(disabled, host, tabId) {
		// Update label
		var newLabel = labels[ Number(disabled) ].replace('DOMAIN', host);
		rweb.browser.contextMenus.update(browserActionMenuItemId, {"title": newLabel});

		// Update badge
		if ( disabled ) {
			// Show X on red
			rweb.browser.browserAction.setBadgeBackgroundColor({
				color: [255, 0, 0, 255], // red
				tabId: tabId,
			});
			rweb.browser.browserAction.setBadgeText({
				text: 'x',
				tabId: tabId,
			});
		}
		else {
			// Hide X
			rweb.browser.browserAction.setBadgeText({
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

rweb.browser.browserAction.onClicked.addListener(function(tab) {
	var a = document.createElement('a');
	a.href = tab.url;
	var host = rweb.host(a.host);

	var uri = rweb.browser.extension.getURL('options/options.html');
	uri += '#' + host;
	rweb.browser.tabs.create({
		url: uri,
		index: tab.index + 1,
		// openerTabId: tab.id,
	});
});

var optionsClosedTimer;

rweb.browser.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	// Content script matched site
	if ( msg && msg.site ) {
		rweb.browser.browserAction.getBadgeText({tabId: sender.tab.id}, function(text) {
			var num = (parseFloat(text) || 0) + 1;
			rweb.browser.browserAction.setBadgeText({
				text: String(num),
				tabId: sender.tab.id
			});
		});

		rweb.browser.browserAction.setBadgeBackgroundColor({
			color: '#000',
			tabId: sender.tab.id
		});
	}

	// Forced auto-download from content script
	if ( msg && msg.forceAutoDownload ) {
		rweb.sync.download(function(summary) {
			if ( summary.imported ) {
				rweb.log('download', true, summary.changes, function() {
					// Log saved
				});
			}

			sendResponse(summary);
		}, true);
		return true;
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
