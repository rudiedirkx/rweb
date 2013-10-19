
var host = rweb.host(location.host);
console.log('[RWeb content] Fetching sites for "' + host + '"');

if ( !sessionStorage.rweb_disabled ) {
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
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if ( msg.rweb && 'disabled' in msg.rweb ) {
		// Requesting disabled status from sessionStorage
		if ( msg.rweb.disabled == '?' ) {
			var stylingDisabled = sessionStorage.rweb_disabled == '1' ? '1' : '';
			sendResponse({"disabled": stylingDisabled});
		}
		// Saving disabled status into sessionStorage
		else {
			sessionStorage.rweb_disabled = msg.rweb.disabled ? '1' : '';
			sendResponse({"disabled": sessionStorage.rweb_disabled});

			// Immediately update page
			if ( sessionStorage.rweb_disabled ) {
				// Remove all CSS
				doCSSUpdate('');
			}
			else {
				// Fetch live CSS
				rweb.sites(host, function(sites) {
					rweb.matched(host, sites);

					var css = '';
					sites.forEach(function(site) {
						css += site.css.trim() + "\n\n";
					});
					doCSSUpdate(css);
				});
			}
		}
	}
});

function doCSSUpdate(css) {
	console.debug('[RWeb content] Updating CSS:', rweb.thousands(css.length) + ' bytes');

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
