
var host = rweb.host(location.host);

// First check sessionStorage for disablability
// Then check local cache for specific host
// And (re)set disablability

if ( !sessionStorage.rwebDisabled || !sessionStorage.rwebExpires || sessionStorage.rwebExpires < Date.now() ) {
	rweb.cached(host, function(site, disabled) {
		// Save local stats
		rweb.matched(host, site);

		// Update sessionStorage
		disabled ? rwebDisable() : rwebEnable();

		// Update browser action
		chrome.runtime.sendMessage({site: site, host: host});

		// Add CSS & JS
		if ( site ) {
			rweb.css(site);
			rweb.js(site);
		}
	}, true);
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if ( msg.rweb && 'disabled' in msg.rweb ) {
		// Immediately update page
		if ( msg.rweb.disabled ) {
			rwebDisable();

			// Remove all CSS
			doCSSUpdate('');
		}
		else {
			rwebEnable();
		}
	}
});

function rwebDisable() {
	sessionStorage.rwebDisabled = 1;
	sessionStorage.rwebExpires = Date.now() + rweb.CONTENT_CACHE_TTL * 1000;
}

function rwebEnable() {
	delete sessionStorage.rwebDisabled;
	delete sessionStorage.rwebExpires;
}

function doCSSUpdate(css) {
	console.debug('[RWeb] Updating CSS:', rweb.thousands(css.length) + ' bytes');

	// Delete all existing style[data-origin="rweb"]
	[].forEach.call(document.querySelectorAll('style[data-origin="rweb"]'), function(el) {
		el.remove();
	});

	// Create 1 new style[data-origin="rweb"]
	rweb.css({css: css});
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if ( msg && !sender.tab && 'cssUpdate' in msg ) {
		var css = msg.cssUpdate;
		doCSSUpdate(css);

		sendResponse({ok: 1});
	}
});
