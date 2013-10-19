
/**
 * To do:
 * [x] 'sites' in storage.sync should be 'chunks'
 * [x] Better dirty check: check hash or JSON, not just onchange (or better!)
 * [x] Unmark newly created site 'disabled' and 'new' so it's opaque after saving
 * [x] Add onbeforeunload to warn about unsaved changes (with better dirty check)
 * [x] Show online/offline/sync status in the sites table
 * [x] Local option 'onBrowserActionClick':
 *      o open options
 *      o open options with site prefilled
 *      o open options with site hilited
 *      o start select0r
 * [x] Create a status report with useless statistics
 * [x] More useful stats in the status report, like hits & misses
 * [x] Key sites by UUID so importing and syncing make sense
 * [x] Create import that respects UUIDs
 * [x] Automatic indenting on { + ENTER and unindenting on }
 * [ ] ? TAB options in options UI (ignore, tab=TAB, tab=CTRL+TAB)
 * [ ] ? Implement Select0r
 */

console.time('UI loaded');

Element.extend({
	setNamedElementValues: function(values, initial) {
		var els = this.getNamedElements();
		$each(values, function(value, name) {
			var el = els[name];
			if ( el ) {
				var bool = el.type == 'checkbox',
					prop1 = bool ? 'checked' : 'value',
					prop2 = bool ? 'defaultChecked' : 'defaultValue';
				if ( name == 'host' ) {
					value = value.replace(/,/g, ', ');
				}
				el[prop1] = value;
				initial && (el[prop2] = value);
			}
		});
		return els;
	},
	getNamedElementValues: function(update) {
		var els = this.getNamedElements(),
			options = {},
			id = rweb.uuid();
		$each(els, function(el, name) {
			var value = el.type === 'checkbox' ? el.checked : el.value.trim();
			if ( name == 'id' && !value ) {
				el.value = value = id;
			}
			if ( update ) {
				el.type === 'checkbox' ? el.defaultChecked = el.checked : el.defaultValue = el.value;
			}
			options[name] = value;
		});
		options.host && (options.host = options.host.replace(/ /g, ''));
		if ( 'host' in options ) {
			options.id || (options.id = id);
		}
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
		if ( 'rows' in this ) {
			min || (min = 3);
			this.rows = min;
			while ( this.clientHeight < this.scrollHeight ) {
				this.rows++;
			}
		}
	},
	enabledOrDisabledClass: function() {
		var site = this.getNamedElementValues(),
			cn = site.enabled ? 'enabled' : 'disabled';
		this.removeClass('disabled').removeClass('enabled').addClass(cn);
		return this;
	},
	toggleCheckboxify: function(cb) {
		cb || (cb = this.getElement('input[type="checkbox"]'));
		this.removeClass('checked').removeClass('unchecked').addClass(cb.checked ? 'checked' : 'unchecked');
	}
});



var $sites, $btnExport, $btnImport, $formImport, $btnStats, $table, $newSite, $prefs;

rweb.ui = {
	_state: '',

	init: function() {
		// Elements
		$sites = $('sites');
		$btnExport = $('btn-export');
		$btnImport = $('btn-import');
		$formImport = $('form-import');
		$btnStats = $('btn-stats');
		$table = $sites.getFirst();
		$newSite = $table.getElement('tbody');
		$prefs = $('prefs');

		// BUILD SITES
		rweb.ui.buildSites(function(sites) {
			rweb.ui.addListeners();

			// Auto indenting of code textareas
			rweb.ui.getPrefs(function(prefs) {
				if ( prefs.autoIndent ) {
					var indent = decodeURIComponent(prefs.autoIndent);
					$sites.getElements('.code').each(function(textarea) {
						doAutoIndent(textarea, indent);
					});
				}
			});

			// Select existing or new site
			if ( location.hash.length > 1 ) {
				rweb.onBrowserActionClick(function(action) {
					if ( action ) {
						var host = location.hash.substr(1),
							matchingSites = rweb.hostFilter(sites, host, false),
							matchingTbodies = new Elements(matchingSites.map(function(site) {
								return $('input[value="' + site.id + '"]', true).firstAncestor('tbody');
							})),
							$site = document.querySelector('input[value="' + host + '"]'),
							$tbody;
						if ( $site ) {
							$tbody = $site.firstAncestor('tbody');
						}
						else {
							$tbody = $('tbody.new-site', 1);
						}

						if ( action == 'hilite' ) {
							matchingTbodies.addClass('hilited');
							if ( !$site ) {
								var $host = $tbody.getElement('.el-host');
								$host.on('focus', function tmpOnFocus() {
									this.value = host;
									this.off('focus', tmpOnFocus);
								});
							}
						}

						if ( action == 'open' ) {
							rweb.ui.openSite($tbody);

							var $host = $tbody.getElement('.el-host');
							$host.value = host;
							$host.focus();
						}
					}
				});
			}

			rweb.ui._state = JSON.encode(rweb.ui.settings());

			document.body.removeClass('loading');

			$$('tfoot input:not([data-disabled])').attr('disabled', null);

			console.timeEnd('UI loaded');
		});

		// SHOW PREFERENCES
		rweb.ui.getPrefs(function(items) {
			$prefs.setNamedElementValues(items, true);
		});

		// SHOW OPTIONAL PERMISSIONS
		rweb.ui.updateOptionalPermissions();
	},
	updateOptionalPermissions: function(callback) {
		var $perms = $$('#permissions li[data-permission]');

		// Cycle through optional permissions to update status and show buttons
		$perms.each(function($li) {
			if ( !$li.getElement('.grant') ) {
				$li.innerHTML += ' <a href class="grant">GRANT</a> <a href class="revoke">REVOKE</a>';
			}

			var perm = $li.dataset.permission;
			chrome.permissions.contains({permissions: [perm]}, function(has) {
				var method = has ? 'addClass' : 'removeClass';
				$li[method]('has');
			});
		});

		// Attach listeners to buttons to toggle permission
		$('permissions').on('click', '.grant, .revoke', function(e) {
			e.preventDefault();

			var $li = this.firstAncestor('[data-permission]'),
				perm = $li.dataset.permission,
				has = $li.hasClass('has'),
				method = has ? 'remove' : 'request';
			chrome.permissions[method]({permissions: [perm]}, function(done) {
				// Can't interpret new status, so just update visuals
				rweb.ui.updateOptionalPermissions();
			});
		});
	},
	getPrefs: function(callback) {
		var prefs = $prefs.getNamedElementValues();
		chrome.storage.local.get(Object.keys(prefs), callback);
	},
	dirty: function() {
		return rweb.ui._state != JSON.encode(rweb.ui.settings());
	},
	siteFilter: function(site) {
		return site.host && ( site.js || site.css );
	},
	buildSites: function(callback) {
// console.time('[RWeb options] buildSites');
		rweb.sites(null, function(sites) {
			sites.each(function(site) {
				var $tbody = document.el('tbody').setHTML($newSite.getHTML()).injectAfter($table.getFirst());
				$tbody.setNamedElementValues(site, true);
				$tbody.enabledOrDisabledClass();
			});
// console.timeEnd('[RWeb options] buildSites');

			callback(sites);
		});
	},
	openSite: function(tbody) {
		rweb.ui.closeSites(tbody);
		tbody.classList.add('expanded');
	},
	closeSites: function(not) {
		$sites.getElements('tbody.expanded').filter(function(tb) {
			return tb != not;
		}).removeClass('expanded');
	},
	settings: function(feedback) {
		return $sites.getElements('tbody')
			.map(function(tb) {
				return tb.getNamedElementValues(feedback);
			})
			.filter(rweb.ui.siteFilter)
		;
	},
	addListeners: function() {
		window.on('beforeunload', function(e) {
			if ( rweb.ui.dirty() ) {
				return "You have unsaved changes. Leaving this page will discard those changes.";
			}
		});

		$sites
			// Open site
			.on('focus', '.el-host', function(e) {
				var tbody = this.firstAncestor('tbody');
				rweb.ui.openSite(tbody);
			})

			// Focus textarea
			.on('focus', 'textarea', function() {
				this.fixRows(this.rows);
			})
			// .on('blur', 'textarea', function() {
				// this.rows = 3;
			// })

			// Toggle 'enabled'
			.on('change', '.el-enabled', rweb.ui.onendisable = function(e) {
				var tbody = this.firstAncestor('tbody');
				tbody.enabledOrDisabledClass();
			})

			// Close site
			.on('keyup', '.el-host', function(e) {
				if ( e.key == Event.Keys.esc ) {
					this.value = this.defaultValue;

					var tbody = this.firstAncestor('tbody');
					rweb.ui.closeSites();
				}
			})

			// Checkboxify
			.on('click', '.checkboxify', function(e) {
				var cb = e.target;
				if ( e.target.nodeName != 'INPUT' ) {
					cb = this.getElement('input[type="checkbox"]');
					cb.checked = !cb.checked;

					rweb.ui.onchange.call(cb, e);
					rweb.ui.onendisable.call(cb, e);
				}

				this.toggleCheckboxify(cb);
			})

			// Save settings
			.on('keydown', function(e) {
				// CTRL + S
				if ( e.key == 83 && e.ctrl ) {
					e.preventDefault();
					this.fire('submit', e);
				}
			})
			.on('submit', function(e) {
				e.preventDefault();

				var settings = rweb.ui.settings(true);

				// Save back to state for dirty check
				rweb.ui._state = JSON.encode(settings);

				rweb.saveSites(settings, function() {
					// clean/dirty => saved
					$sites.removeClass('dirty').addClass('saved');

					// After 1 sec: saved => clean
					setTimeout(function() {
						$sites.removeClass('saved');
					}, 1000);

					// Propagate new CSS to open tabs
					var focused = document.activeElement;
					if ( focused ) {
						var tbody = focused.firstAncestor('tbody');
						if ( tbody ) {
							var updatedHosts = tbody.getElement('.el-host');
							if ( updatedHosts ) {
								rweb.ui.propagateNewCSS(updatedHosts.value);
							}
						}
					}
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
			.on('change', rweb.ui.onchange = function(e) {
				var state = JSON.encode(rweb.ui.settings()),
					changed = state != rweb.ui._state,
					method = changed ? 'addClass' : 'removeClass';
				$sites[method]('dirty');
			})
			.on('keyup', 'input, textarea', function(e) {
				// Undo disabled state
				if ( this.hasClass('code') && this.value != '' ) {
					var tbody = this.firstAncestor('tbody');
					tbody.removeClass('new-site');
				}

				// Check dirty
				if ( !$sites.hasClass('dirty') ) {
					var state = JSON.encode(rweb.ui.settings());
					if ( state != rweb.ui._state ) {
						$sites.addClass('dirty');
					}
				}

				// Fix textarea height
				this.fixRows(this.rows);
			})
		;

		$sites.getElements('.checkboxify').toggleCheckboxify();

		$btnExport.on('click', function(e) {
			$('form-import').hide();

			var settings = rweb.ui.settings(false);

			var ta = $('ta-export');
			ta.value = JSON.stringify(settings);
			ta.show().focus();
			ta.selectionStart = 0;
			ta.selectionEnd = ta.value.length;
		});

		$btnImport.on('click', function(e) {
			$('ta-export').hide();

			$('form-import').show();
			$('ta-import').focus();
		});

		$formImport.on('submit', function(e) {
			e.preventDefault();

			// Parse import
			var code = this.elements.code.value;
console.log(code);
			try {
				var newSites = JSON.parse(code);
			}
			catch (ex) {
				alert('Invalid code:\n\n' + ex);
			}

			// Validate import
			if ( newSites instanceof Array ) {
				newSites = newSites.filter(rweb.ui.siteFilter);
				if ( newSites.length ) {
					return rweb.sitesByUUID(function(existingSites, existingSitesList) {
						var add = [],
							update = 0;
						newSites.forEach(function(site) {
							if ( !site.id || !existingSites[site.id] ) {
								site.id || (site.id = rweb.uuid());
								add.push(site);
							}
							else {
								$merge(existingSites[site.id], site);
								update++;
							}
						});
						// Summarize & confirm
						if ( confirm('Import summary:\n\n' + add.length + ' sites will be added\n' + update + ' sites will be updated\n\nDo you agree? Changes will be saved directly and cannot be undone.') ) {
							add.forEach(function(site) {
								existingSitesList.push(site);
							});
							rweb.saveSites(existingSitesList, function() {
								location.reload();
							});
						}
					});
				}
				return alert('No valid sites found');
			}
			return alert('Not an array of sites');
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
				console.log('[RWeb report]  ', thousands(offline), 'offline sites');
				console.log('[RWeb report]  ', thousands(online), 'online sites');
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
						console.log('[RWeb report]  ', thousands(num), 'x - ' + host);
					});
				}
			});
		});

		$prefs.on('submit', function(e) {
			e.preventDefault();

			var prefs = this.getNamedElementValues(true);

			chrome.storage.local.set(prefs, function(items) {
				$prefs.addClass('saved');
				setTimeout(function() {
					$prefs.removeClass('saved');
				}, 1000);
			});
		});
	},
	propagateNewCSS: function(updatedHosts) {
		var permission = null;
		chrome.tabs.query({active: false}, function(tabs) {
			tabs.forEach(function(tab) {
				if ( !tab.url ) {
					if ( permission === null ) {
						console.warn('[RWeb options] Could not propagate updated CSS to', updatedHosts, '. Check optional permissions.');
						permission = false;
					}
					return;
				}

				permission = true;

				var a = document.createElement('a');
				a.href = tab.url;
				var host = rweb.host(a.host);
				if ( rweb.hostMatch(updatedHosts, host) ) {
					var sites = sites = rweb.ui.settings(),
						matches = rweb.hostFilter(sites, host),
						css = '';
					matches.forEach(function(site) {
						css += site.css.trim() + "\n\n";
					});
					console.log('[RWeb options] Propagating new CSS to', host);
					chrome.tabs.sendMessage(tab.id, {cssUpdate: css}, function(response) {
						console.log('[RWeb options] Propagated new CSS to', host, response);
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
