
/**
 * Load sites and inject CSS & JS
 */

if ( document.documentElement && document.documentElement.nodeName == 'HTML' && location.protocol != 'chrome-extension:' ) {
	var host = rweb.host(location.host);
	rweb.site(host, function(site, meta) {

		var specific = site ? site.specific : 0;
		var wildcard = site ? site.wildcard : 0;
		document.documentElement.dataset.rweb = host + '/' + specific + '/' + wildcard;

		if ( site && !meta.disabled ) {
			// Save stats
			if ( site.specific ) {
				rweb.matched(host);
			}

			// Add CSS & JS
			site.css && rweb.css(site.css);
			site.js && rweb.js(site.js);
		}

		if ( !meta.lastDownload || meta.lastDownload < Date.now() - rweb.MUST_DOWNLOAD_EVERY_N_MINUTES * 60000 ) {
			if ( !meta.downloadingSince || meta.downloadingSince < Date.now() - 10000 ) {
				if ( !meta.dirty ) {
					console.log('[RWeb] WILL START AUTO-DOWNLOAD NOW! See background script for log.');
					rweb.browser.runtime.sendMessage({forceAutoDownload: true}, function(response) {
						if (response && response.imported) {
							console.log('[RWeb] DOWNLOADED SITES!');
						}
						else {
							console.warn('[RWeb] NOT DOWNLOADED...', response);
						}
					});
				}
				else {
					if (meta.lastDownload) {
						// Only nofity if this is news. If there has NEVER been a download, we're probably not connected.
						console.warn("[RWeb] NOT STARTING AUTO-DOWNLOAD, because local state is dirty. Go to options page to fix.");
					}
				}
			}
		}
	});
}



/**
 * Listen for disabling this host/website
 */

rweb.browser.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if ( msg.rweb && 'disabled' in msg.rweb ) {
		// Immediately update page
		if ( msg.rweb.disabled ) {
			// Remove all CSS
			disableLocalRWebCSS();
		}
		else {
			enableLocalRWebCSS(msg.rweb.css);
		}
	}
});

function disableLocalRWebCSS() {
	[].forEach.call(document.querySelectorAll('style[data-origin="rweb"]'), function(el) {
		el.disabled = true;
	});
}

function enableLocalRWebCSS(css) {
	doCSSUpdate(css);
}



/**
 * Listen for CSS updates from the options page
 */

function doCSSUpdate(css) {
	console.debug('[RWeb] Updating CSS:', rweb.thousands(css.length) + ' bytes');

	// Delete existing style[data-origin="rweb"]
	[].forEach.call(document.querySelectorAll('style[data-origin="rweb"]'), function(el) {
		el.remove();
	});

	// Create 1 new style[data-origin="rweb"]
	rweb.css(css);
}

rweb.browser.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if ( msg && !sender.tab && 'cssUpdate' in msg ) {
		var css = msg.cssUpdate;
		doCSSUpdate(css);

		sendResponse({ok: 1});
	}
});
