
Element.extend({
	setNamedElementValues: function(values, initial) {
		var els = this.getNamedElements();
		r.each(values, function(value, name) {
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
		r.each(els, function(el, name) {
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
	},
});



var $sites, $table, $newSite, $prefs;

rweb.ui = {
	_state: '',

	nformat: function(n, dec) {
		var P = Math.pow(10, dec || 0),
			n = String(Math.round(n * P) / P);

		var x = n.split('.');
		x[0] = ('  ' + x[0]).slice(-2);
		x[1] || (x[1] = '0');
		x[1] = (x[1] + '0000000000').substr(0, dec);

		return x.join('.');
	},

	init: function() {
		// Elements
		$sites = $('sites');
		$table = $sites.getFirst();
		$newSite = $table.getElement('tbody');
		$prefs = $('prefs');

		// // BUILD SITES
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
				var host = rweb.host(location.hash.substr(1));

				// Hilite ass matching sites
				$$('.el-host').each(function(el) {
					if (rweb.hostMatch(el.value, host)) {
						el.ancestor('tbody').addClass('hilited');
					}
				});

				// Fetch the most specific targeted site to open it
				var $openSite = $('tbody[data-host="' + host + '"]', true) || $('tbody.hilited', true);
				if ( $openSite ) {
					rweb.onBrowserActionClick(function(action) {
						if ( action == 'open' ) {
							rweb.ui.openSite($openSite);
							$openSite.getElement('.el-host').focus();
						}
					});
				}

				// Add host to new site, when opened
				var $newHost = $('tbody.new-site', true).getElement('.el-host');
				$newHost.on('focus', function tmpOnFocus() {
					if (!this.value) {
						this.value = host;
					}
				});
			}

			rweb.ui._state = JSON.encode(rweb.ui.settings());

			document.body.removeClass('loading');

			$$('tfoot input:not([data-disabled])').attr('disabled', null);

			chrome.runtime.sendMessage({optionsOpened: true}, function(response) {
				// No relevant response
			});
		});

		// SHOW PREFERENCES
		rweb.ui.getPrefs(function(items) {
			$prefs.setNamedElementValues(items, true);
		});
	},
	getPrefs: function(callback) {
		var prefs = $prefs.getNamedElementValues();
		chrome.storage.local.get(Object.keys(prefs), callback);
	},
	dirty: function() {
		return rweb.ui._state != JSON.encode(rweb.ui.settings());
	},
	buildSites: function(callback) {
		rweb.sites(null, function(sites) {
			sites.each(function(site) {
				var $tbody = document.el('tbody').setHTML($newSite.getHTML()).injectAfter($table.getFirst());
				$tbody.data('host', site.host);
				$tbody.data('id', site.id);
				$tbody.setNamedElementValues(site, true);
				$tbody.enabledOrDisabledClass();
			});

			callback(sites);
		});
	},
	openSite: function(tbody) {
		rweb.ui.closeSites(tbody);
		tbody.classList.add('expanded');
		setTimeout(function() {
			tbody.getElement('.el-host').focus();
			setTimeout(function() {
				tbody.scrollIntoViewIfNeeded();
			}, 1);
		}, 1);
	},
	closeSites: function(not) {
		$sites.getElements('tbody.expanded').filter(function(tb) {
			return tb != not;
		}).removeClass('expanded');
	},
	settings: function(update) {
		return $sites.getElements('tbody')
			.map(function(tb) {
				return tb.getNamedElementValues(update);
			})
			.filter(rweb.siteFilter)
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
				var tbody = this.ancestor('tbody');
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
				var tbody = this.ancestor('tbody');
				tbody.enabledOrDisabledClass();
			})

			// Close site
			.on('keyup', '.el-host', function(e) {
				if ( e.key == Event.Keys.esc ) {
					this.value = this.defaultValue;

					var tbody = this.ancestor('tbody');
					rweb.ui.closeSites();
					this.blur();
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
						var tbody = focused.ancestor('tbody');
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
					var tbody = this.ancestor('tbody');
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



		/**
		 * SITE META DATA
		 */

		var history;

		function updateMetaDataLocation($site, which) {
			var $label = $site.getElement('.el-metadata');

			// Update label position
			if ( !which || which == 'position' ) {
				var $host = $site.getElement('.el-host');
				if ( $host.value == '' ) {
					$label.css('left', '100%');
				}
				else {
					var tmp = document.el('span').addClass('tmp-site-host-width').setText($host.value);
					document.body.append(tmp);
					setTimeout(function() {
						var width = tmp.offsetWidth;
						tmp.remove();

						if ( parseFloat($label.css('left')) != width ) {
							$label.css('left', width + 'px');
						}
					});
				}
			}

			if ( !which || which == 'css' ) {
				var $css = $site.getElement('.el-css');
				var b = $css.value.length;
				$label.getElement('.el-meta-css').setText(b ? rweb.thousands(b) : '0');
			}

			if ( !which || which == 'js' ) {
				var $js = $site.getElement('.el-js');
				var b = $js.value.length;
				$label.getElement('.el-meta-js').setText(b ? rweb.thousands(b) : '0');
			}

			if ( !which ) {
				$label.hidden = false;

				var $host = $site.getElement('.el-host');
				$label.getElement('.el-meta-matched').setText(rweb.thousands(history[$host.value] || 0, true));
			}
		}

		function tickUpdateMetaDataLocation() {
			var el = document.activeElement;
			if ( el.hasClass('el-host') ) {
				var $site = el.ancestor('tbody');
				updateMetaDataLocation($site, 'position');
			}
			else if ( el.hasClass('el-css') ) {
				var $site = el.ancestor('tbody');
				updateMetaDataLocation($site, 'css');
			}
			else if ( el.hasClass('el-js') ) {
				var $site = el.ancestor('tbody');
				updateMetaDataLocation($site, 'js');
			}

			requestAnimationFrame(tickUpdateMetaDataLocation);
		}

		rweb.ui.getPrefs(function(items) {
			if ( items.inlineStats && parseInt(items.inlineStats) ) {
				requestAnimationFrame(tickUpdateMetaDataLocation);
				chrome.storage.local.get('history', function(items) {
					history = items.history || {};

					$sites.getElements('tbody').forEach(function($site) {
						updateMetaDataLocation($site);
					});
				});
			}
		});



		/**
		 * UPLOAD & DOWNLOAD
		 */

		$('btn-download').on('click', function(e) {
			e.preventDefault();

			var btn = this;
			btn.addClass('loading');
			rweb.sync.download(function(imported) {
				// Done
				console.log('Manual download done');
				if ( imported ) {
					rweb.log('download', false, function() {
						location.reload();
					});
				}
				btn.removeClass('loading');
			});
		});

		$('btn-upload').on('click', function(e) {
			e.preventDefault();

			var btn = this;
			btn.addClass('loading');
			rweb.sync.upload(function() {
				rweb.log('upload', false, function() {
					// Log saved
				});

				// Done
				console.log('Manual upload done');
				// alert('Uploaded!');

				btn.removeClass('dirty');
				btn.removeClass('loading');
			});
		});

		chrome.storage.local.get(['dirty', 'lastUpload', 'lastDownload'], function(items) {
			var uploadTitle = [];
			if ( items.dirty ) {
				$('btn-upload').addClass('dirty');
				uploadTitle.push("'DIRTY' LOCAL STATE: you have local saved changes not uploaded to Drive");
			}
			uploadTitle.push('Last upload was: ' + (new Date(items.lastUpload)));
			$('btn-upload').attr('title', uploadTitle.join("\n\n"));

			var downloadTitle = [];
			if ( items.lastDownload && items.lastDownload < Date.now() - rweb.MUST_DOWNLOAD_EVERY_N_MINUTES * 60000 ) {
				$('btn-download').addClass('behind');
				downloadTitle.push("LOCAL STATE IS BEHIND: it's been more than " + rweb.MUST_DOWNLOAD_EVERY_N_MINUTES + " minutes since auto-download");
			}
			downloadTitle.push('Last download was: ' + (new Date(items.lastDownload)));
			$('btn-download').attr('title', downloadTitle.join("\n\n"));
		});

		// Enable buttons only if SYNC is enabled
		rweb.sync.connect(function(token) {
			if ( token ) {
				$$('#btn-download, #btn-upload').prop('disabled', false);
				document.body.addClass('sync-enabled');
			}
		}, 2);

		$('btn-connect2drive').on('click', function(e) {
			e.preventDefault();

			rweb.sync.connect(function(token) {
				alert('Done! Now download and upload manually once, and then it will be automatic.');
				location.reload();
			});
		});



		/**
		 * OPEN SYNC LOG
		 */

		$('btn-sync-log').on('click', function(e) {
			e.preventDefault();

			var $form = $('form-sync-log');
			if ( $form.toggle() ) {
				$form.scrollIntoViewIfNeeded();

				var $ta = $('ta-sync-log');
				chrome.storage.local.get(['log'], function(items) {
					var logs = items.log || [];

					var rpad = function(str, len) {
						for (var i=str.length; i<len; i++) {
							str += ' ';
						}
						return str;
					};

					var lines = [];
					logs.forEach(function(log) {
						lines.push(
							rpad(log.type, 10) +
							rpad(log.automatic ? 'automatic' : 'manual', 11) +
							String(new Date(log.utc))
						);
					});
					$ta.value = lines.join("\n");
				});
			}
		});



		/**
		 * EXPORT
		 */

		$('btn-export').on('click', function(e) {
			e.preventDefault();

			var settings = rweb.ui.settings(false);

			var $form = $('form-export');
			if ( $form.toggle() ) {
				$form.scrollIntoViewIfNeeded();

				var $ta = $('ta-export');
				$ta.value = JSON.stringify(settings);
				$ta.focus();
				$ta.selectionStart = 0;
				$ta.selectionEnd = $ta.value.length;
			}
		});



		/**
		 * IMPORT
		 */

		$('btn-import').on('click', function(e) {
			e.preventDefault();

			var $form = $('form-import');
			if ( $form.toggle() ) {
				$form.scrollIntoViewIfNeeded();

				var $ta = $('ta-import');
				$ta.focus();
			}
		});

		$('form-import').on('submit', function(e) {
			e.preventDefault();

			// Parse import
			var code = this.elements.code.value;
			try {
				var newSites = JSON.parse(code);
			}
			catch (ex) {
				return alert('Invalid code:\n\n' + ex);
			}

			rweb.sync.import(newSites, function(imported) {
				if ( imported ) {
					rweb.log('import', false, function() {
						location.reload();
					});
				}
			});
		});



		/**
		 * DISABLED / BLACKLIST
		 */

		$('btn-disabled').on('click', function(e) {
			e.preventDefault();

			chrome.storage.local.get('disabled', function(items) {
				var disabled = items.disabled || {},
					hosts = Object.keys(disabled);

				var $form = $('form-disabled');
				if ( $form.toggle() ) {
					$form.scrollIntoViewIfNeeded();

					var $ta = $('ta-disabled');
					$ta.setText(hosts.join("\n")).focus();
				}
			});
		});

		$('form-disabled').on('submit', function(e) {
			e.preventDefault();
			var $form = this;

			var hosts = $('ta-disabled').value.trim();
			hosts = hosts ? hosts.split("\n") : [];

			var disabled = {};
			hosts.forEach(function(host) {
				disabled[host] = true;
			});

			chrome.storage.local.set({"disabled": disabled}, function() {
				$form.addClass('saved');
				setTimeout(function() {
					$form.removeClass('saved');
				}, 1000);
			});
		});



		/**
		 * SEARCH
		 */

		$('btn-search').on('click', function(e) {
			e.preventDefault();

			var $form = $('form-search');
			if ( $form.toggle() ) {
				$form.scrollIntoViewIfNeeded();

				var $inp = $('inp-search');
				$inp.focus();
			}
		});

		$('form-search').on('submit', function(e) {
			e.preventDefault();

			var q = this.elements.query.value;
			if ( !q.trim() ) {
				return;
			}

			var cs = this.elements.cs.checked;
			if ( !cs ) {
				q = q.toLowerCase();
			}

			$$('.hilited').removeClass('hilited');

			var sites = rweb.ui.settings();
			var matches = [];
			sites.forEach(function(site) {
				var match = false;
				var css = !cs ? site.css.toLowerCase() : site.css;
				var js = !cs ? site.js.toLowerCase() : site.js;

				var $tbody = $('tbody[data-id="' + site.id + '"]', true);

				var inCSS = css.split(q).length-1;
				if ( inCSS ) {
					match = true;
					$tbody.getElement('.el-css').addClass('hilited');
				}

				var inJS = js.split(q).length-1;
				if ( inJS ) {
					match = true;
					$tbody.getElement('.el-js').addClass('hilited');
				}

				if ( match ) {
					$tbody.addClass('hilited');
					matches.push('CSS: ' + inCSS + '  JS: ' + inJS + '  - <a href="#" data-id="' + site.id + '" class="host">' + site.host.replace(/,/g, ', ') + '</a>');
				}
			});

			$('search-results-num-sites').setText(matches.length);
			$('search-results').addClass('open');
			var html = matches ? '<li>' + matches.join('</li><li>') + '</li>' : '';
			$('search-results-summary').setHTML(html);

			this.scrollIntoViewIfNeeded();
		});

		$('search-results').on('click', 'a.host[data-id]', function(e) {
			e.preventDefault();

			var id = this.data('id');
			var $tbody = $('tbody[data-id="' + id + '"]', true);
			rweb.ui.openSite($tbody);
		});



		/**
		 * PREFERENCES
		 */

		$prefs.on('submit', function(e) {
			e.preventDefault();

			var prefs = this.getNamedElementValues(true);

			chrome.storage.local.set(prefs, function() {
				$prefs.addClass('saved');
				setTimeout(function() {
					$prefs.removeClass('saved');
				}, 1000);
			});
		});

	}, // addListeners()

	propagateNewCSS: function(updatedHosts) {
		chrome.storage.local.get(['disabled'], function(items) {
			var disabled = items.disabled || {};
			var sites = rweb.ui.settings();
			var counter = {};

			chrome.tabs.query({active: false}, function(tabs) {
				tabs.forEach(function(tab) {
					var a = document.createElement('a');
					a.href = tab.url;
					var host = rweb.host(a.host);

					if ( !disabled[host] && rweb.hostMatch(updatedHosts, host) ) {
						var matches = rweb.hostFilter(sites, host),
							css = '';
						matches.forEach(function(site) {
							css += site.css.trim() + "\n\n";
						});

						counter[host] = (counter[host] || 0) + 1;
						var count = counter[host];

						console.time('[RWeb] Propagated new CSS to "' + host + '" (' + count + ')');
						chrome.tabs.sendMessage(tab.id, {cssUpdate: css}, function(rsp) {
							console.timeEnd('[RWeb] Propagated new CSS to "' + host + '" (' + count + ')');
						});
					}
				});
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

	// Hide notifications
	var notifidsRead = (localStorage.notifidsRead || '').split(' ');
	$$('p[data-notifid]').each(function(el) {
		var id = el.data('notifid');
		if ( notifidsRead.contains(id) ) {
			el.addClass('read');
		}
		else {
			el.append(document.createTextNode(' '));
			el.append(document.el('a').attr('href', '').setText('Got it!').on('click', function(e) {
				e.preventDefault();
				notifidsRead.push(id);
				localStorage.notifidsRead = notifidsRead.join(' ').trim();
				el.addClass('read');
			}));
		}
	});

	// Apply local styling
	rweb.site('options', function(site) {
		if ( site ) {
			site.css && rweb.css(site.css);
		}
	}, {includeWildcard: false});

	// Upload when closing options page
	window.onbeforeunload = function() {
		chrome.runtime.sendMessage({optionsClosed: true}, function(response) {
			// This tab is gone already
		});
	};
};
