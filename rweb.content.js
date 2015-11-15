
/**
 * Load sites and inject CSS & JS
 */

if ( document.documentElement && document.documentElement.nodeName == 'HTML' && location.protocol != 'chrome-extension:' ) {
	var host = rweb.host(location.host);
	rweb.site(host, function(site, meta) {
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
					chrome.runtime.sendMessage({forceAutoDownload: true}, function(response) {
						// Never reaches here, because sendResponse in bg script doesn't work!?
						console.log('[RWeb] DOWNLOADED SITES!');
					});
				}
				else {
					console.warn("[RWeb] NOT STARTING AUTO-DOWNLOAD, because local state is dirty. Go to options page to fix.");
				}
			}
		}
	});
}



/**
 * Listen for disabling this host/website
 */

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if ( msg.rweb && 'disabled' in msg.rweb ) {
		// Immediately update page
		if ( msg.rweb.disabled ) {
			// Remove all CSS
			disableLocalRWebCSS();
		}
		else {
			enableLocalRWebCSS();
		}
	}
});

function disableLocalRWebCSS() {
	xableLocalRWebCSS(true);
}

function enableLocalRWebCSS() {
	xableLocalRWebCSS(false);
}

function xableLocalRWebCSS(disabled) {
	[].forEach.call(document.querySelectorAll('style[data-origin="rweb"]'), function(el) {
		el.disabled = disabled;
	});
}



/**
 * Listen for CSS updates from the options page
 */

function doCSSUpdate(css) {
	console.debug('[RWeb] Updating CSS:', rweb.thousands(css.length) + ' bytes');

	// Delete existing style[data-origin="rweb"]
	var el = document.querySelector('style[data-origin="rweb"]');
	el && el.remove();

	// Create 1 new style[data-origin="rweb"]
	rweb.css(css);
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
	if ( msg && !sender.tab && 'cssUpdate' in msg ) {
		var css = msg.cssUpdate;
		doCSSUpdate(css);

		sendResponse({ok: 1});
	}
});
