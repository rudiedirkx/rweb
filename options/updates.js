
rweb.updates = [

	/**
	 * Test
	 */

	function(next) { /**/ alert('1'); next(); /**/ },



	/**
	 * Rename 'sites' to 'chunks' in online storage
	 */

	function(next) {
		chrome.storage.sync.get(['sites', 'chunks'], function(items) {
			if ( items.chunks != null && items.sites == null ) {
				return next();
			}

			chrome.storage.sync.set({chunks: items.sites || 0}, function() {
				chrome.storage.sync.get(['sites', 'chunks'], function(items) {
					if ( items.chunks != null ) {
						return chrome.storage.sync.remove('sites', function() {
							return next();
						});
					}

					throw "Updating online storage didn't work... 'sites' is still 'sites' and not 'chunks'.";
				});
			});
		});
	},



	/**
	 * Add UUID to existing sites
	 */

	function(next) {
		// Fetch
		rweb.sites(null, function(sites) {
			// Alter
			sites.forEach(function(site) {
				site.id = rweb.uuid();
			});
			// Save
			rweb.saveSites(sites, function() {
				next();
			});
		});
	},



	/**
	 * Set default for local option `extendNodeList`
	 */

	function(next) {
		var prefs = {extendNodeList: "0"};
		chrome.storage.local.set(prefs, function() {
			next();
		});
	},



	/**
	 * Set default for local option `alwaysOutline`
	 */

	function(next) {
		var prefs = {alwaysOutline: "0"};
		chrome.storage.local.set(prefs, function() {
			next();
		});
	},



	/**
	 * Move all `sync` sites to `local`
	 */

	function(next) {
		// Fetch local and online backup
		chrome.storage.local.get(['onlineSites', 'sites'], function(items) {
			var sites = items.sites || [],
				online = items.onlineSites || [];
			// Combine online backup into local
			online.forEach(function(site) {
				delete site.sync;
				sites.push(site);
			});

			// Add a catch-all to show we can
			sites.push({
				id: rweb.uuid(),
				enabled: true,
				host: '*',
				css: '',
				js: "(['forEach', 'slice', 'filter', 'map', 'indexOf']).forEach(function(method) {\n\tHTMLCollection.prototype[method] = NodeList.prototype[method] = Array.prototype[method];\n});",
			});

			// Save all as local
			rweb.saveSites(sites, function() {
				// Delete local backup
				// chrome.storage.local.remove('onlineSites', function() {
					// Delete online sites
					chrome.storage.sync.remove(['chunks', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'], function() {
						next();
					});
				// });
			});
		});
	},



	/**
	 * Remove deprecated settings and local cache
	 */

	function(next) {
		chrome.storage.local.get(null, function(items) {
			var remove = ['alwaysOutline', 'extendNodeList', 'lastDownSync', 'lastReCache'];
			Object.keys(items).forEach(function(name) {
				if (name.indexOf('cache__') == 0) {
					remove.push(name);
				}
			});

			chrome.storage.local.remove(remove, function() {
				next();
			});
		});
	},



	/**
	 * Notify the user
	 */

	function(next) {
		setTimeout(function() {
			var message = [
				"Hi there!",
				"I just ran 2 updates to  pull all your online sites local and remove them from Google's Extension Data storage, because it's unreliable and slow.",
				"Instead, we'll be using Google Drive. You can UPLOAD and DOWNLOAD manually any time you want. It's still in the cloud, but you can actually SEE it. You can even share it, edit it, delete it, or just ignore it.",
				"In case I really messed up and done broke it all, there's still a local backup, but it's hidden, so contact me (via Chrome Webstore) for help. SORRY!",
				"If this is the first computer you see this on, UPLOAD it all. Otherwise, DOWNLOAD it all.",
			];
			alert(message.join("\n\n"));
			setTimeout(function() {
				next();
			}, 400);
		}, 400);
	},

];
