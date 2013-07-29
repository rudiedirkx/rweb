
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

];
