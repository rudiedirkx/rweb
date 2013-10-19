
try {
	var menuItemId = chrome.contextMenus.create({
		"title": 'DISABLE for this website',
		"type": 'checkbox',
		"documentUrlPatterns": ['http://*/*', 'https://*/*'],
		"onclick": function(info, tab) {
			var disabled = info.checked ? '1' : '';

			// Update tabs, like options.js does & save setting
			chrome.tabs.sendMessage(tab.id, {"rweb": {"disabled": disabled}} /*, function(rsp) {
				console.log('Checkbox saved on', tab.url, rsp);
			}*/ );
		}
	});

	chrome.tabs.onHighlighted.addListener(function(info) {
		chrome.tabs.sendMessage(info.tabIds[0], {"rweb": {"disabled": "?"}}, function(rsp) {
			if ( rsp && 'disabled' in rsp ) {
				var disabled = rsp.disabled == '1';
				chrome.contextMenus.update(menuItemId, {"checked": disabled});
			}
		});
	});
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

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
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
