
rweb = {
	USABLE_ONLINE_STORAGE: .8,
	CONTENT_CACHE_TTL: 300,

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

	matched: function(host, site, callback) {
		if ( site ) {
			chrome.storage.local.get('history', function(items) {
				var history = items.history || {};
				history[host] = (history[host] || 0) + 1;
				chrome.storage.local.set({history: history}, function() {
					callback && callback();
				});
			});
		}
	},

	saveSites: function(sites, callback) {
		var offline = [], online = [];
		sites.forEach(function(site) {
			site.sync ? online.push(site) : offline.push(site);
		});
// console.debug('offline', JSON.stringify(offline).length, 'online', JSON.stringify(online).length);

		var saved = 0,
			requireSaves = 2,
			cbProxy = function() {
// console.debug('Saved', saved+1);
				if ( ++saved == requireSaves ) {
					callback();
				}
			};

		// Save offline
		var data = {sites: offline};
		online.length && (data.onlineSites = online); // Only overwrite online if it's not empty.
		chrome.storage.local.set({sites: offline, onlineSites: online}, cbProxy);

		// Save online
		chrome.storage.sync.get('chunks', function(items) {
			var data = JSON.stringify(online),
				chunkSize = chrome.storage.sync.QUOTA_BYTES_PER_ITEM * rweb.USABLE_ONLINE_STORAGE,
				chunks = {chunks: 0};

			while ( data ) {
				chunks[chunks.chunks++] = data.substr(0, chunkSize);
				data = data.substr(chunkSize);
			}
// console.debug('Sync save', chunks);

			// Remove unused upstream keys
			if ( items.chunks ) {
				var remove = [];
				for ( var i=chunks.chunks; i<items.chunks; i++ ) {
					remove.push(String(i));
				}
// console.debug('Sync remove', remove);
				if ( remove.length ) {
					requireSaves++;
					chrome.storage.sync.remove(remove, cbProxy);
				}
			}

			chrome.storage.sync.set(chunks, cbProxy);
		});
	},
	hostMatch: function(hosts, host) {
		return hosts.replace(/\s+/g, '').split(',').indexOf(host) != -1;
	},
	hostFilter: function(sites, host, enabled) {
		enabled == null && (enabled = true);
		return sites.filter(function(site) {
			return ( !enabled || site.enabled ) && site.host.split(',').indexOf(host) != -1;
		});
	},
	cached: function(host, callback, checkDisabled) {
		host || (host = '');
console.time('[RWeb] Fetched (cached) sites for "' + host + '"');
		var key = 'cache__' + host;
		chrome.storage.local.get([key, 'disabled', 'extendNodeList', 'alwaysOutline'], function(items) {
			var options = {
				extendNodeList: parseFloat(items.extendNodeList),
				alwaysOutline: parseFloat(items.alwaysOutline),
			};

			if ( items.disabled && items.disabled[host] ) {
				callback(null, true, options);
				console.warn('[RWeb] RWeb was explicitly disabled for "' + host + '". I\'ll check again in ' + rweb.CONTENT_CACHE_TTL + ' seconds.');
console.timeEnd('[RWeb] Fetched (cached) sites for "' + host + '"');
				return;
			}

			var site = items[key] || false;
console.timeEnd('[RWeb] Fetched (cached) sites for "' + host + '"');
			callback(site, false, options);
		});
	},
	sites: function(host, callback, checkDisabled) {
		host || (host = '');
console.time('[RWeb] Fetched sites for "' + host + '"');
		var saved = 0,
			requireSaves = 2,
			cbProxy = function() {
				if ( ++saved == requireSaves ) {
					// All sites, online & offline have been fetched

					if ( checkDisabled && disabled[host] ) {
						callback([], true);
						console.warn('[RWeb] RWeb was explicitly disabled for this host', host);
console.timeEnd('[RWeb] Fetched sites for "' + host + '"');
						return;
					}

					// If this is a query, don't bother sorting, but filter
					if ( host ) {
						var matches = []
						sites.forEach(function(site) {
							if ( site.enabled && site.host.split(',').indexOf(host) != -1 ) {
								matches.push(site);
							}
						});
						sites = matches;
					}
					// No query, so sort and no filter
					else {
						sites.sort(function(a, b) {
							return a.host < b.host ? 1 : -1;
						});
					}

console.timeEnd('[RWeb] Fetched sites for "' + host + '"');
					callback(sites, false);
				}
			},
			onlineData = '',
			sites = [],
			disabled;

		function addSites(source) {
// console.debug('addSites', source.length);
			source.forEach(function(site) {
				sites.push(site);
			});

			// Added another batch of sites, maybe all of them
			cbProxy();
		}

		function parseOnlineData(json) {
// console.debug('json', json.length);
			var data = JSON.parse(json);
// console.debug('data', data);
			// Online data isn't namespaced into 'sites', like unencoded offline data
			addSites(data);
		}

		// Get ONLINE
// console.time('chrome.storage.sync.get');
		chrome.storage.sync.get(['chunks', '0', '1', '2', '3'], function(items) {
// console.timeEnd('chrome.storage.sync.get');
			if ( items.chunks ) {
				// Append JSON data
				var loadMore = [];
				for ( var i=0; i<items.chunks; i++ ) {
					if ( i in items ) {
						onlineData += items[i];
					}
					else {
						loadMore.push(String(i));
					}
				}
// console.debug('onlineData', onlineData.length);
// console.debug('loadMore', loadMore);

				if ( loadMore.length ) {
// console.time('chrome.storage.sync.get');
					chrome.storage.sync.get(loadMore, function(items) {
// console.timeEnd('chrome.storage.sync.get');
						loadMore.forEach(function(index) {
							onlineData += items[index];
						});
// console.debug('onlineData', onlineData.length);

						// onlineData should be complete
						parseOnlineData(onlineData);
					});
				}
				else {
					// onlineData should be complete
					parseOnlineData(onlineData);
				}
			}
			else {
				// No sites in online storage, so skip parsing etc, straight to callback proxy
				cbProxy();
			}
		});

		// Get OFFLINE
// console.time('chrome.storage.local.get');
		chrome.storage.local.get(['sites', 'disabled'], function(items) {
// console.timeEnd('chrome.storage.local.get');
			disabled = items.disabled || {};
// console.debug('offline sites', items.sites);
			if ( items.sites ) {
				addSites(items.sites);
			}
			else {
				// No sites in offline storage, so straight to callback proxy
				cbProxy();
			}
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

	css: function(site, options) {
		var attachTo = document.head || document.body || document.documentElement;
		if ( attachTo ) {
			var css = site.css.trim();
			if ( options.alwaysOutline ) {
				css += "\n\n:focus { outline: -webkit-focus-ring-color auto 5px !important; }";
			}

			var el = document.createElement('style');
			el.dataset.origin = 'rweb';
			el.textContent = css.trim();

			rweb.insert(attachTo, el);
		}
	},
	js: function(site, options) {
		var attachTo = document.head || document.body || document.documentElement;
		if ( site.js && attachTo && location.protocol != 'chrome-extension:' ) {
			var el = document.createElement('script');
			el.dataset.origin = 'rweb';

			var js = '(function() {';
			if ( options.extendNodeList ) {
				js += "['forEach', 'slice', 'filter', 'map', 'indexOf'].forEach(function(method) { HTMLCollection.prototype[method] = NodeList.prototype[method] = Array.prototype[method]; });";
			}
			js += "var ready = function(cb) { document.readyState == 'interactive' ? cb() : document.addEventListener('DOMContentLoaded', cb); }\n";
			js += "var load = function(cb) { document.readyState == 'complete' ? cb() : window.addEventListener('load', cb, true); }\n";
			js += site.js;
			js += "})();\n";

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
	},
	recache: function(callback) {
console.time('[RWeb] Re-cached all sites into local');
		chrome.storage.local.get(null, function(items) {
			var cidPrefix = 'cache__';
			var remove = {};
			$each(items, function(val, key) {
				if ( key.indexOf(cidPrefix) === 0 ) {
					remove[key] = 1;
				}
			});
// console.debug('remove', remove);

			var cache = {};
			rweb.sites(null, function(sites) {
				$each(sites, function(site) {
					if ( site.enabled ) {
						site.host.split(',').forEach(function(host) {
							var cid = cidPrefix + host;
							cache[cid] || (cache[cid] = {js: '', css: ''});

							cache[cid].css = (cache[cid].css + "\n\n" + site.css.trim()).trim();
							cache[cid].js = (cache[cid].js + "\n\n" + site.js.trim()).trim();

							delete remove[cid];
						});
					}
				});
// console.debug('cache', cache);
// console.debug('remove', remove);

				var todo = 2,
					done = function() {
						if ( --todo == 0 ) {
console.timeEnd('[RWeb] Re-cached all sites into local');
							callback && callback();
						}
					};

				chrome.storage.local.remove(Object.keys(remove), done);
				cache['lastReCache'] = Date.now();
				chrome.storage.local.set(cache, done);
			});
		});
	}
};

// rweb.Sites = function Sites() {
	// localStorage.constructor.call(this);
// };
// rweb.Sites.prototype = Object.create(Storage.prototype);
// rweb.Sites.prototype.constructor = rweb.Sites;
