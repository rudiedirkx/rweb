
rweb = {
	// STORAGE: 'local',
	// cache: 0,

	host: function(host) {
		return host.replace(/^www\./, '');
	},

	// savePrefs: function(prefs, callback) {
		// chrome.storage[rweb.STORAGE].set({prefs: prefs}, callback);
	// },
	// prefs: function(callback) {
		// chrome.storage[rweb.STORAGE].get('prefs', function(items) {
			// callback(items.prefs || {});
		// });
	// },

	matched: function(host, sites, callback) {
		if ( sites && sites.length ) {
			chrome.storage.local.get('history', function(items) {
				var history = items.history || {};
				history[host] = (history[host] || 0) + sites.length;
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
				chunkSize = chrome.storage.sync.QUOTA_BYTES_PER_ITEM * 0.8,
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
	sites: function(host, callback) {
		var saved = 0,
			requireSaves = 2,
			cbProxy = function() {
				if ( ++saved == requireSaves ) {
					// All sites, online & offline have been fetched

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

					// rweb.cache++;
console.log('[RWeb helpers] Fetched sites for "' + host + '"', sites);
					callback(sites);
				}
			},
			onlineData = '',
			sites = [];

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
		chrome.storage.sync.get(['chunks', '0', '1', '2', '3'], function(items) {
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
					chrome.storage.sync.get(loadMore, function(items) {
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
		chrome.storage.local.get('sites', function(items) {
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

	css: function(site) {
		var attachTo = document.head || document.body || document.documentElement;
		if ( site.css && attachTo ) {
			var el = document.createElement('style');
			el.dataset.origin = 'rweb';
			el.textContent = site.css;

			attachTo.appendChild(el);
		}
	},
	js: function(site, wrap) {
		var attachTo = document.head || document.body || document.documentElement;
		if ( site.js && attachTo && location.protocol != 'chrome-extension:' ) {
			var el = document.createElement('script');
			el.dataset.origin = 'rweb';
			var js = !wrap ? site.js : "document.addEventListener('DOMContentLoaded', function(e) {\n" + site.js + "\n});";
			el.textContent = js;

			attachTo.appendChild(el);
		}
	}
};

// rweb.Sites = function Sites() {
	// localStorage.constructor.call(this);
// };
// rweb.Sites.prototype = Object.create(Storage.prototype);
// rweb.Sites.prototype.constructor = rweb.Sites;
