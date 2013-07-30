
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
		rweb.js(site, !!document.head);
	});
});
