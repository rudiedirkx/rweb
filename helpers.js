
rweb = {
	MUST_DOWNLOAD_EVERY_N_MINUTES: 30,

	// MUST KEEP THIS UP TO DATE //
	unify: function(site) {
		// In order of ABC
		return {
			css: site.css || '',
			host: site.host.trim(),
			id: site.id,
			js: site.js || '',
		};
	},
	// MUST KEEP THIS UP TO DATE //

	uuid: function() {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			var r = Math.random() * 16 | 0,
				v = c == 'x' ? r : r & 0x3 | 0x8;
			return v.toString(16);
		});
	},

	host: function(host, m) {
		if ( m = host.match(/\/\/([^/]+)\//) ) {
			host = m[1];
		}

		return host.replace(/^www\./, '');
	},

	onBrowserActionClick: function(callback) {
		chrome.storage.local.get('onBrowserActionClick', function(items) {
			callback(items.onBrowserActionClick || '');
		});
	},

	matched: function(host, callback) {
		chrome.storage.local.get('history', function(items) {
			var history = items.history || {};
			history[host] = (history[host] || 0) + 1;
			chrome.storage.local.set({history: history}, function() {
				callback && callback();
			});
		});
	},

	saveSites: function(sites, callback) {
		chrome.storage.local.set({sites: sites, lastSave: Date.now()}, callback);
	},
	hostMatch: function(hosts, host) {
		return hosts.replace(/\s+/g, '').split(',').indexOf(host) != -1;
	},
	hostFilter: function(sites, host, enabled) {
		enabled == null && (enabled = true);
		return sites.filter(function(site) {
			if ( !enabled || site.enabled ) {
				if ( site.host == '*' || site.host.split(',').indexOf(host) != -1 ) {
					return true;
				}
			}
		});
	},
	sites: function(host, callback) {
console.log('rweb.sites()');
		// Get OFFLINE
		chrome.storage.local.get(['sites', 'disabled'], function(items) {
			var disabled = host && items.disabled && items.disabled[host];
			var sites = items.sites || [];

			// If this is a query, don't bother sorting, but filter
			if ( host ) {
				sites = rweb.hostFilter(sites, host, true);
			}
			// No query, so sort and no filter
			else {
				sites.sort(function(a, b) {
					return a.host < b.host ? 1 : -1;
				});
			}

console.log('sites ("' + (host || '') + '")', sites.length, sites);
			callback(sites, disabled);
		});
	},

	site: function(host, callback, connect) {
		rweb.sites(host, function(sites, disabled) {
			if ( !sites.length ) {
				return callback(false, disabled);
			}

			var css = '', js = '';
			sites.forEach(function(site) {
				css += "\n" + site.css;
				js += "\n" + site.js;
			});

			var site = {css: css.trim(), js: js.trim()};
			callback(site, disabled);
		});
	},

	sitesByUUID: function(callback) {
		var handler = function(list) {
			var sites = {};
			list.forEach(function(site) {
				sites[site.id] = site;
			});
			return sites;
		};

		// Sites passed
		if ( callback instanceof Array ) {
			return handler(callback);
		}

		// Fetch sites now
		return rweb.sites(null, function(list) {
			callback(handler(list), list);
		});
	},

	css: function(css) {
		var attachTo = document.head || document.body || document.documentElement;
		if ( attachTo ) {
			var css = css.trim();

			var el = document.createElement('style');
			el.dataset.origin = 'rweb';
			el.textContent = css.trim();

			rweb.insert(attachTo, el);
		}
	},
	js: function(js) {
		var attachTo = document.head || document.body || document.documentElement;
		if ( attachTo ) {
			var el = document.createElement('script');
			el.dataset.origin = 'rweb';

			js =
				'(function() {\n\n' +
				"var ready = function(cb) { document.readyState == 'interactive' ? cb() : document.addEventListener('DOMContentLoaded', cb); };\n" +
				"var load = function(cb) { document.readyState == 'complete' ? cb() : window.addEventListener('load', cb, true); };\n" +
				"\n\n" +
				js + "\n" +
				"\n\n" +
				"})();\n";
			el.textContent = js;

			rweb.insert(attachTo, el);
		}
	},
	insert: function(attachTo, el) {
		if ( attachTo.firstElementChild ) {
			attachTo.insertBefore(el, attachTo.firstElementChild);
		}
		else {
			attachTo.appendChild(el);
		}
	},

	thousands: function(num, nokilo) {
		if ( !nokilo && num > 5000 ) {
			return rweb.thousands(num/1000, true) + ' k';
		}

		if ( num < 100 ) {
			return String(Math.round(num*10) / 10);
		}

		return String(Math.round(num)).split('').reverse().join('').match(/.{1,3}/g).join(',').split('').reverse().join('');
	}
};
