
var host = rweb.host(location.host);
console.log('[RWeb content] Fetching sites for "' + host + '"');

rweb.sites(host, function(sites) {
	rweb.matched(host, sites);

	// Update browser action
	chrome.runtime.sendMessage({sites: sites, host: host}, function(response) {
		// I don't care. background.js will have triggered the badge, or not
	});

	// Add CSS & JS
	sites.forEach(function(site) {
		rweb.css(site);
		rweb.js(site);
	});
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	if ( !sender.tab && request.cssUpdate ) {
		var css = request.cssUpdate;
		console.log('[RWeb content] Updating CSS:\n', css);

		// Delete all existing style[data-origin="rweb"]
		[].forEach.call(document.querySelectorAll('style[data-origin="rweb"]'), function(el) {
			el.remove();
		});

		// Create 1 new style[data-origin="rweb"]
		rweb.css({css: css});

		sendResponse({ok: 1});
	}
});
