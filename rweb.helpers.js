
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
	siteFilter: function(site) {
		return site.host.trim() && ( site.js || site.css );
	},
	// MUST KEEP THIS UP TO DATE //

	equal: function(site1, site2) {
		return JSON.stringify(site1) == JSON.stringify(site2);
	},

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
		chrome.storage.local.set({
			sites: sites,
			lastSave: Date.now(),
			dirty: true,
		}, callback);
	},

	hostMatch: function(hosts, host) {
		return hosts.replace(/\s+/g, '').split(',').indexOf(host) != -1;
	},
	hostFilter: function(sites, host, options) {
		options || (options = {});
		var checkEnabled = options.checkEnabled != null ? options.checkEnabled : true;
		var includeWildcard = options.includeWildcard != null ? options.includeWildcard : true;

		return sites.filter(function(site) {
			if ( !checkEnabled || site.enabled ) {
				if ( (includeWildcard && site.host == '*') || rweb.hostMatch(site.host, host) ) {
					return true;
				}
			}
		});
	},

	sites: function(host, callback, options) {
		console.time('rweb.sites ("' + host + '")');
		chrome.storage.local.get(['sites', 'dirty', 'disabled', 'lastDownload', 'downloadingSince'], function(items) {
			var dirty = Boolean(items.dirty);
			var disabled = host && items.disabled && items.disabled[host] ? true : false;
			var sites = items.sites || [];

			var meta = {
				dirty: dirty,
				disabled: disabled,
				lastDownload: items.lastDownload || 0,
				downloadingSince: items.downloadingSince || 0,
			};

			// If this is a query, don't bother sorting, but filter
			if ( host ) {
				sites = rweb.hostFilter(sites, host, options);
			}
			// No query, so sort and no filter
			else {
				sites.sort(function(a, b) {
					return a.host < b.host ? 1 : -1;
				});
			}

			if ( host && !meta.disabled ) {
				console.timeEnd('rweb.sites ("' + host + '")');
			}
			callback(sites, meta);
		});
	},
	site: function(host, callback, options) {
		rweb.sites(host, function(sites, meta) {
			if ( !sites.length ) {
				return callback(false, meta);
			}

			var css = '', js = '';
			var wildcard = 0, specific = 0;
			sites.forEach(function(site) {
				css += "\n" + site.css;
				js += "\n" + site.js;

				site.host == '*' && wildcard++;
				rweb.hostMatch(site.host, host) && specific++;
			});

			if ( !meta.disabled ) {
				console.debug('- sites: ' + sites.length + ', specific: ' + Number(specific) + ', wildcard: ' + Number(wildcard));
			}

			var site = {
				css: css.trim(),
				js: js.trim(),
				wildcard: wildcard,
				specific: specific,
			};
			callback(site, meta);
		}, options);
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

	log: function(type, automatic, changes, callback) {
		var log = {
			type: type,
			automatic: !!automatic,
			changes: changes,
			utc: Date.now(),
		};
		chrome.storage.local.get(['log'], function(items) {
			var logs = items.log || [];
			logs.unshift(log);
			chrome.storage.local.set({log: logs}, function() {
				callback && callback(logs.length);
			});
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
		if ( !nokilo && num > 1100 ) {
			return rweb.thousands(num/1000, true) + ' k';
		}

		if ( num < 100 ) {
			return String(Math.round(num*10) / 10);
		}

		return String(Math.round(num)).split('').reverse().join('').match(/.{1,3}/g).join(',').split('').reverse().join('');
	}
};
