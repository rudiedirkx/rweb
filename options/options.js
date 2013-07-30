
/**
 * To do:
 * [x] 'sites' in storage.sync should be 'chunks'
 * [ ] Better dirty check: check hash or JSON, not just onchange (or better!)
 * [ ] Unmark newly created site 'disabled' and 'new' so it's opaque after saving
 * [ ] Show online/offline/sync status in the sites table
 * [ ] Local option 'onBrowserActionClick':
 *      o open options
 *      o open options with site prefilled
 *      o open options with site hilited
 *      o start select0r
 * [x] Create a status report with useless statistics
 * [x] More useful stats in the status report, like hits & misses
 * [ ] Create indiscriminate import (only add, remove nothing)
 * [ ] Key sites by GUID so importing and syncing make sense
 * [ ] ? Implement Select0r
 */

Element.extend({
	getNamedElementValues: function(update) {
		var els = this.getNamedElements(),
			options = {};
		$each(els, function(el, name) {
			var value = el.type === 'checkbox' ? el.checked : el.value.trim();
			if ( update ) {
				el.type === 'checkbox' ? el.defaultChecked = el.checked : el.defaultValue = el.value;
			}
			options[name] = value;
		});
		options.host && (options.host = options.host.replace(/ /g, ''));
		return options;
	},
	getNamedElements: function() {
		var els = this.getElements('[name]'),
			options = {};
		els.each(function(el) {
			options[el.name] = el;
		});
		return options;
	},
	fixRows: function(min) {
		min || (min = 3);
		this.rows = min;
		while ( this.clientHeight < this.scrollHeight ) {
			this.rows++;
		}
	},
	enabledOrDisabledClass: function() {
		var site = this.getNamedElementValues(),
			cn = site.enabled ? 'enabled' : 'disabled';
		this.removeClass('disabled').removeClass('enabled').addClass(cn);
		return this;
	}
});



var $sites, $btnExport, $btnStats, $table, $newSite, $prefs;

rweb.ui = {
	init: function() {
		// Elements
		$sites = $('sites');
		$btnExport = $('btn-export');
		$btnStats = $('btn-stats');
		$table = $sites.getFirst();
		$newSite = $table.getElement('tbody');
		// $prefs = $('prefs');

		// Sites
		rweb.ui.buildSites(function() {
			rweb.ui.addListeners();

			if ( location.hash.length > 1 ) {
				var host = rweb.host(location.hash.substr(1));
				var site = document.querySelector('input[value="' + host + '"]'),
					tbody;
				if ( site ) {
					tbody = site.firstAncestor('tbody');
				}
				else {
					tbody = $('tbody.new-site', 1);
				}
				tbody.getElement('a.expands-site').click();
				var $host = tbody.getElement('.el-host');
				$host.value = host;
				$host.focus();
			}

			document.body.removeClass('loading');

			$$('tfoot input').attr('disabled', null);
		});

		// Prefs
		// var options = $prefs.getNamedElements();
		// rweb.prefs(function(prefs) {
// console.debug('Prefs from chrome.storage:\n', prefs);
			// rweb.ui.fill(options, prefs);
		// });
		// $prefs.on('submit', function(e) {
			// e.preventDefault();

			// var prefs = $prefs.getNamedElementValues(true);
			// console.debug(prefs);
			// rweb.savePrefs(prefs);
		// });
	},
	fill: function(elements, settings) {
		$each(settings, function(value, name) {
			var el = elements[name];
			if ( el ) {
				var bool = el.type == 'checkbox',
					prop1 = bool ? 'checked' : 'value',
					prop2 = bool ? 'defaultChecked' : 'defaultValue';
				el[prop1] = el[prop2] = value;
			}
		});
	},
	buildSites: function(callback) {
// console.time('[RWeb options] buildSites');
		rweb.sites(null, function(sites) {
			sites.each(function(site) {
				var $tbody = document.el('tbody').setHTML($newSite.getHTML()).injectAfter($table.getFirst()),
					options = $tbody.getNamedElements();
				rweb.ui.fill(options, site);
				$tbody.enabledOrDisabledClass();
			});
// console.timeEnd('[RWeb options] buildSites');

			callback();
		});
	},
	addListeners: function() {
		$sites
			// Expand site
			.on('click', 'a.expands-site', function(e) {
				e.preventDefault();

				var tbody = this.firstAncestor('tbody');

				$sites.getElements('tbody.expanded').filter(function(tb) {
					return tb != tbody;
				}).removeClass('expanded');

				if ( tbody.classList.toggle('expanded') ) {
					// var tas = tbody.getElements('textarea');
					// tas.fixRows();

					// var ta = tas[0];
					// ta.focus();
					// ta.selectionStart = 0;
				}
			})

			// Focus textarea
			.on('focus', 'textarea', function() {
				this.fixRows(this.rows);
			})

			// Toggle 'enabled'
			.on('change', '.el-enabled', function() {
				var tbody = this.firstAncestor('tbody');
				tbody.enabledOrDisabledClass();
			})

			// Close site
			.on('keyup', '.el-host', function(e) {
				if ( e.key == Event.Keys.esc ) {
					this.value = this.defaultValue;
					this.firstAncestor('tbody').removeClass('expanded');
				}
			})

			// Save settings
			.on('keydown', function(e) {
				if ( e.key == 83 && e.ctrl ) {
					e.preventDefault();
					this.fire('submit', e);
				}
			})
			.on('submit', function(e) {
				e.preventDefault();

				var settings = $sites.getElements('tbody')
					.map(function(tb) {
						return tb.getNamedElementValues(true);
					})
					.filter(function(setting) {
						return setting.host && ( setting.js || setting.css );
					})
				;

				rweb.saveSites(settings, function() {
					$sites.removeClass('dirty').addClass('saved');

					// var tas = $sites.getElements('textarea');
					// tas.fixRows();

					setTimeout(function() {
						$sites.removeClass('saved');
					}, 1000);
				});
			})

			// Reset values & dirty state
			.on('reset', function(e) {
				var form = this.removeClass('dirty');
				setTimeout(function() {
					form.getElements('tbody').each(function(tbody) {
						tbody.enabledOrDisabledClass();
					});
				}, 1);
			})

			// Tag dirty
			.on('change', function(e) {
				$sites.addClass('dirty');
			})
			.on('keyup', 'input, textarea', function(e) {
				var changed = this.type == 'checkbox' ? this.defaultChecked != this.checked : this.defaultValue != this.value
				if ( changed ) {
					$sites.addClass('dirty');
				}
				this.fixRows && this.fixRows(this.rows);
			})
		;

		$btnExport.on('click', function(e) {
			var settings = $sites.getElements('tbody')
				.map(function(tb) {
					return tb.getNamedElementValues();
				})
				.filter(function(setting) {
					return setting.host && ( setting.js || setting.css );
				})
			;
			var ta = $('ta-export');
			ta.value = JSON.stringify(settings);
			ta.show().focus();
			ta.selectionStart = 0;
			ta.selectionEnd = ta.value.length;
		});

		$btnStats.on('click', function(e) {
			function thousands(num, nokilo) {
				if ( !nokilo && num > 5000 ) {
					return thousands(num/1000, true) + ' k';
				}

				if ( num < 100 ) {
					return String(Math.round(num*10) / 10);
				}

				return String(Math.round(num)).split('').reverse().join('').match(/.{1,3}/g).join(',').split('').reverse().join('');
			}

			rweb.sites(null, function(sites) {
				var online = 0, offline = 0;
				sites.forEach(function(site) {
					site.sync ? online++ : offline++;
				});
				console.log('[RWeb report]', thousands(sites.length), 'sites');
				console.log('[RWeb report]', thousands(offline), 'offline sites');
				console.log('[RWeb report]', thousands(online), 'online sites');
			});
			chrome.storage.sync.get('chunks', function(items) {
				console.log('[RWeb report]', thousands(items.chunks), 'online chunks (max chunk size =', thousands(chrome.storage.sync.QUOTA_BYTES_PER_ITEM), ')');
			});
			chrome.storage.sync.getBytesInUse(null, function(bytes) {
				var pct = Math.ceil(100 * bytes / (chrome.storage.sync.QUOTA_BYTES * rweb.USABLE_ONLINE_STORAGE));
				console.log('[RWeb report]', thousands(bytes), '/', thousands(chrome.storage.sync.QUOTA_BYTES * rweb.USABLE_ONLINE_STORAGE), 'bytes (', pct, '%) online storage in use');
			});
			chrome.storage.local.getBytesInUse(null, function(bytes) {
				var pct = Math.ceil(100 * bytes / (chrome.storage.local.QUOTA_BYTES));
				console.log('[RWeb report]', thousands(bytes), '/', thousands(chrome.storage.local.QUOTA_BYTES), 'bytes (', pct, '%) offline storage in use');
			});
			chrome.storage.local.get('history', function(items) {
				if ( items.history ) {
					console.log('[RWeb report] Matching history:');
					$each(items.history, function(num, host) {
						console.log('[RWeb report]   ', thousands(num), 'x - ' + host);
					});
				}
			});
		});
	}
};

document.body.onload = function() {
	// Do updates & don't init
	localStorage.version || (localStorage.version = rweb.updates.length);
	if ( localStorage.version < rweb.updates.length ) {
		var updates = rweb.updates.slice(localStorage.version);
		if ( confirm("The extension requires local updating.\n\nI have " + updates.length + " updates queued. I am ready to do those right now.\n\nIt won't init without those updates.") ) {
			try {
				var update = -1,
					next = function() {
						update++;
						if ( updates[update] ) {
							updates[update](next);
						}
						else {
							finish();
						}
					},
					finish = function() {
						localStorage.version -= -update;
						alert("DONE! I will now reload, ready to go.");
						location.reload();
					}
				;

				next();
			}
			catch (ex) {
				localStorage.version -= -update;
				alert("OH NO! Error while updating! I will be useless until you fix:\n\n====\n" + ex + "\n====");
			}
		}
		return;
	}

	// Init
	rweb.ui.init();

	// Apply local styling
	rweb.sites('::', function(sites) {
		sites.forEach(function(site) {
			rweb.css(site, true);
			rweb.js(site, true);
		});
	});
};
