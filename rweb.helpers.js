
rweb = {
	MUST_DOWNLOAD_EVERY_N_MINUTES: 30,

	// WebExtensions compatibility //
	browser: typeof browser != 'undefined' ? browser : chrome,
	// @todo Allow other auth than 'getAuthToken' when Drive CORS is fixed!?
	identity: (typeof browser != 'undefined' ? browser : chrome).identity,
	// WebExtensions compatibility //

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

	host: function(host) {
		host = host.replace(/^.+\/\//, '');
		host = host.replace(/\/.*/, '');
		host = host.replace(/^www\./, '');
		host = host.replace(/:\d+$/, '');

		return host;
	},

	onBrowserActionClick: function(callback) {
		rweb.browser.storage.local.get('onBrowserActionClick', function(items) {
			callback(items.onBrowserActionClick || '');
		});
	},

	matched: function(host, callback) {
		rweb.browser.storage.local.get('history', function(items) {
			var history = items.history || {};
			history[host] = (history[host] || 0) + 1;
			rweb.browser.storage.local.set({history: history}, function() {
				callback && callback();
			});
		});
	},

	saveSites: function(sites, callback) {
		rweb.browser.storage.local.set({
			sites: sites,
			lastSave: Date.now(),
			dirty: true,
		}, callback);
	},

	skipUrl: function(url) {
		return url.match(/^chrome(\-extension):\/\//) ? true : false;
	},

	hostsMatch: function(hosts, host, options) {
		options || (options = {});
		var exact = options.exact != null ? options.exact : false;

		if ( !exact ) {
			if (hosts == 'all' || hosts == 'matches') {
				return true;
			}
		}

		hosts = hosts.split(',');
		return hosts.some(function(subject) {
			var regex = '^' + subject
				.trim()
				.replace(/([\.\-])/g, '\\$1')
				.replace(/\*\*/g, '.+')
				.replace(/\*/g, '[^\\.]+') + '$';
			return new RegExp(regex).test(host);
		});
	},
	hostFilter: function(sites, host, options) {
		options || (options = {});
		var checkEnabled = options.checkEnabled != null ? options.checkEnabled : true;
		var exact = options.exact != null ? options.exact : false;

		return sites.filter(function(site) {
			if ( !checkEnabled || site.enabled ) {
				if ( exact ? site.host === host : rweb.hostsMatch(site.host, host) ) {
					return true;
				}
			}
		});
	},

	siteSorter: function(a, b) {
		var diff = rweb.siteSorterHost(a, b);
		if ( diff != 0 ) {
			return diff;
		}

		diff = rweb.siteSorterWeight(a, b);
		if ( diff != 0 ) {
			return diff;
		}

		return rweb.siteSorterUuid(a, b);
	},

	siteSorterHost: function(a, b) {
		if (a.host == b.host) return 0;
		else if (a.host == 'all') return -1;
		else if (b.host == 'all') return 1;
		else if (a.host == 'matches') return -1;
		else if (b.host == 'matches') return 1;
		else if (a.host == 'options') return -1;
		else if (b.host == 'options') return 1;
		else return a.host < b.host ? -1 : 1;
	},

	siteSorterUuid: function(a, b) {
		return a.id < b.id ? -1 : 1;
	},

	siteSorterWeight: function(a, b) {
		return a.weight == b.weight ? 0 : (a.weight < b.weight ? -1 : 1);
	},

	sites: function(host, callback, options) {
		// console.time('rweb.sites ("' + host + '")');
		rweb.browser.storage.local.get(['sites', 'dirty', 'disabled', 'lastDownload', 'downloadingSince'], function(items) {
			var dirty = Boolean(items.dirty);
			var disabled = host && items.disabled && items.disabled[host] ? true : false;
			var sites = (items.sites || []).map(function(site) {
				site.weight = parseInt(site.weight || '0');
				return site;
			});

			var meta = {
				dirty: dirty,
				disabled: disabled,
				lastDownload: items.lastDownload || 0,
				downloadingSince: items.downloadingSince || 0,
				special: 0,
			};

			// If this is a query, don't bother sorting, but filter
			if ( host ) {
				sites = rweb.hostFilter(sites, host, options);

				sites.sort(rweb.siteSorter);

				meta.special = sites.reduce(function(special, site) {
					return special + Number(site.host == 'all' || site.host == 'matches');
				}, 0);
			}
			// No query, so sort and no filter
			else {
				sites.sort(rweb.siteSorter);
			}

			if ( host && !meta.disabled ) {
				// console.timeEnd('rweb.sites ("' + host + '")');
			}
			callback(sites, meta);
		});
	},
	site: function(host, callback, options) {
		rweb.sites(host, function(sites, meta) {
			if ( !sites.length ) {
				return callback(false, meta);
			}

			// Without specific matches, remove "matches" sites
			if ( meta.special == sites.length ) {
				sites = sites.filter(function(site) {
					return site.host != 'matches';
				});
			}

			var css = '', js = '';
			var wildcard = 0, specific = 0;
			sites.forEach(function(site) {
				css += "\n" + site.css;
				js += "\n" + site.js;

				if ( site.host == 'all' || site.host == 'matches' ) {
					wildcard++;
				}
				else {
					specific++;
				}
			});

			if ( !meta.disabled ) {
				// console.debug('- sites: ' + sites.length + ', specific: ' + specific + ', wildcard: ' + wildcard);
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
		rweb.browser.storage.local.get(['log'], function(items) {
			var logs = items.log || [];
			logs.unshift(log);

			if ( logs.length > 1000 ) {
				logs.splice(1000);
			}

			rweb.browser.storage.local.set({log: logs}, function() {
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
	js: async function(js) {
		const attachTo = document.head || document.body || document.documentElement;
		if ( attachTo ) {
			// const el = document.createElement('script');
			// el.dataset.origin = 'rweb';

			const wrap = function(cb, delay) {
				return delay == null ? cb : function() { setTimeout(cb, delay); };
			};
			const ready = function(cb, delay) {
				cb = wrap(cb, delay);
				document.readyState == 'interactive' || document.readyState == 'complete' ? cb() : document.addEventListener('DOMContentLoaded', cb);
			};
			const load = function(cb, delay) {
				cb = wrap(cb, delay);
				document.readyState == 'complete' ? cb() : window.addEventListener('load', cb, true);
			};

			const extension = function(callback, data) {
				return new Promise(resolve => {
					const RWEB_CHANNEL = new BroadcastChannel('rweb');
					RWEB_CHANNEL.postMessage({sendCallback: String(callback), sendData: data});
					RWEB_CHANNEL.onmessage = e => e.data.receiveData && resolve(e.data.receiveData);
				});
			};

			js =
				'(function() {\n\n' +
				"const wrap = " + String(wrap) + ";\n" +
				"const ready = " + String(ready) + ";\n" +
				"const load = " + String(load) + ";\n" +
				"const extension = " + String(extension) + ";\n" +
				"\n\n" +
				js + "\n" +
				"\n\n" +
				"})();\n";
			// el.textContent = js;

// console.time('inject js');
			await rweb.browser.runtime.sendMessage({
				inject: {js},
			});
// console.timeEnd('inject js');
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
