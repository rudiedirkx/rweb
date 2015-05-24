
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

	equal: function(site1, site2) {
		return JSON.stringify(site1) == JSON.stringify(site2);
	},

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
	siteFilter: function(site) {
		return site.host && ( site.js || site.css );
	},
	buildSites: function(callback) {
		rweb.sites(null, function(sites) {
			sites.each(function(site) {
				var $tbody = document.el('tbody').setHTML($newSite.getHTML()).injectAfter($table.getFirst());
				$tbody.attr('data-host', site.host);
				$tbody.setNamedElementValues(site, true);
				$tbody.enabledOrDisabledClass();
			});

			callback(sites);
		}, rweb.ui.download);
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
	settings: function(update) {
		return $sites.getElements('tbody')
			.map(function(tb) {
				return tb.getNamedElementValues(update);
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
console.log(updatedHosts.value);
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
			if ( items.inlineStats ) {
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

		$('btn-download').on('click', function() {
			rweb.ui.download();
		});

		$('btn-upload').on('click', function() {
			rweb.ui.upload();
		});



		/**
		 * EXPORT
		 */

		$('btn-export').on('click', function(e) {
			var settings = rweb.ui.settings(false);

			var $form = $('form-export');
			if ( $form.toggle() ) {
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
			if ( $('form-import').toggle() ) {
				$('ta-import').focus();
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

			rweb.ui.import(newSites);
		});



		/**
		 * DISABLED / BLACKLIST
		 */

		$('btn-disabled').on('click', function(e) {
			chrome.storage.local.get('disabled', function(items) {
				var disabled = items.disabled || {},
					hosts = Object.keys(disabled);

				$('form-disabled').show();
				$('ta-disabled').setText(hosts.join("\n")).focus();
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
	},

	import: function(newSites, callback) {
		// Validate import
		if ( newSites instanceof Array ) {
			newSites = newSites.filter(rweb.ui.siteFilter);
			if ( newSites.length ) {
				return rweb.sitesByUUID(function(existingSites, existingSitesList) {
					var add = [],
						update = [];
					newSites.forEach(function(site) {
						if ( !site.id || !existingSites[site.id] ) {
							site.id || (site.id = rweb.uuid());
							add.push(site);
							return;
						}

						var oldSite = rweb.unify(existingSites[site.id]);
						var newSite = rweb.unify(site);
						if ( !rweb.ui.equal(oldSite, newSite) ) {
							r.merge(existingSites[site.id], site);
							update.push(site.host);
						}
					});

					// Print detailed log before asking confirmation
					console.log("\n\n==== IMPORT LOG ====");
					console.log("TO ADD:\n" + add.map(function(site) {
						return ' - ' + site.host;
					}).join("\n"));
					console.log("TO UPDATE:\n" + update.map(function(host) {
						return ' - ' + host;
					}).join("\n"));
					console.log("==== IMPORT LOG ====\n\n");

					// Summarize & confirm
					var message = [
						"Import summary:",
						([
							newSites.length + " sites were detected",
							add.length + " sites will be added",
							update.length + " sites will be updated",
						]).join("\n"),
						"(the console contains a more detailed log)",
						"Do you agree?",
					];
					if ( confirm(message.join("\n\n")) ) {
						add.forEach(function(site) {
							existingSitesList.push(site);
						});
						rweb.saveSites(existingSitesList, function() {
							location.reload();
						});

						callback(true);
					}

					callback(false);
				});
			}

			callback(false);
			return alert('No valid sites found');
		}

		callback(false);
		return alert('Not an array of sites');
	},

	connect: function(callback) {
		// alert('Connecting to Google Drive for data storage...');
		chrome.identity.getAuthToken({interactive: true}, function(token) {
			callback(token);
		});
	},
	download: function() {
		var handler = function(sites) {
			console.log('Downloaded sites', sites);

			rweb.ui.import(sites, function(imported) {
				if ( imported ) {
					chrome.storage.local.set({lastDownload: Date.now()}, function() {
						console.log('Saved `lastDownload.');
					});
				}
			});
		};

		rweb.ui.connect(function(token) {
			rweb.ui.drive.list(token, function(rsp) {
				// File exists, download data
				if ( rsp.items.length ) {
					var file = rsp.items[0];
					rweb.ui.drive.download(token, file, function(data) {
						// Usable data
						if ( data ) {
							handler(data);
						}
						// No data, or corrupt
						else {
							rweb.ui.drive.upload(token, file.id, function(data) {
								handler(data);
							});
						}
					});
				}
				// File doesn't exist, create and upload
				else {
					rweb.ui.drive.create(token, function(file) {
						rweb.ui.drive.upload(token, file.id, function(data) {
							handler(data);
						});
					});
				}
			}); // drive.list()
		}); // connect()
	},
	upload: function() {
		var upload = function(token, file) {
			rweb.ui.drive.upload(token, file.id, function(data) {
				chrome.storage.local.set({lastUpload: Date.now()}, function() {
					console.log('Saved `lastUpload.');
					alert('Uploaded!');
				});
			});
		};

		rweb.ui.connect(function(token) {
			rweb.ui.drive.list(token, function(rsp) {
				// File exists, overwrite
				if ( rsp.items.length ) {
					var file = rsp.items[0];
					upload(token, file);
				}
				// File doesn't exist, create & upload
				else {
					rweb.ui.drive.create(token, function(file) {
						upload(token, file);
					});
				}
			}); // drive.list()
		}); // connect()
	},
	drive: {
		wrapLoad: function(type, body) {
			return function(e) {
				var status = parseFloat(this.getResponseHeader('status'));
console.debug(type + ':status', status);

				// Unauthorized
				if ( status == 401 ) {
					rweb.ui.connect(function(token) {
						chrome.identity.removeCachedAuthToken({token: token}, function() {
							alert("Authentication error during '" + type + "'. Try again after this reload.");
							location.reload();
						});
					});
				}
				// Success
				else if ( status >= 200 && status < 400 ) {
					body.call(this, e);
				}
				// Any error
				else {
					console.error('RESPONSE:', this.responseText);
					alert("Unrecoverable error during '" + type + "'. Check console for details.");
				}
			};
		},
		wrapCallback: function(type, callback) {
			return rweb.ui.drive.wrapLoad(type, function(e) {
console.debug(type + ':load', this, e);
				var rsp = JSON.parse(this.responseText);
console.debug(type + ':data', rsp);
				callback(rsp);
			});
		},
		wrapError: function(type) {
			return function(e) {
				console.warn(type + ':error', this, e);
				alert('There was an error connecting to Drive. Check the console.');
			};
		},
		list: function(token, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('GET', 'https://www.googleapis.com/drive/v2/files', true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.onload = rweb.ui.drive.wrapCallback('list', callback);
			xhr.onerror = rweb.ui.drive.wrapError('list');
			xhr.send();
		},
		create: function(token, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('POST', 'https://www.googleapis.com/drive/v2/files', true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.onload = rweb.ui.drive.wrapCallback('create', callback);
			xhr.onerror = rweb.ui.drive.wrapError('create');

			var data = {
				"title": "rweb.sites.json",
				"mimeType": "text/json",
				"description": "All RWeb configured sites for " + chrome.runtime.id,
			};
			xhr.send(JSON.stringify(data));
		},
		upload: function(token, fileId, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('PUT', 'https://www.googleapis.com/upload/drive/v2/files/' + fileId, true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.onload = rweb.ui.drive.wrapCallback('upload', callback);
			xhr.onerror = rweb.ui.drive.wrapError('upload');

			var sites = rweb.ui.settings(false);
console.debug('upload:output', sites);
			xhr.send(JSON.stringify(sites));
		},
		download: function(token, file, callback) {
			var xhr = new XMLHttpRequest;
			xhr.open('GET', file.downloadUrl, true);
			xhr.setRequestHeader('Authorization', 'Bearer ' + token);
			xhr.onload = rweb.ui.drive.wrapLoad('download', function(e) {
console.debug('download:load', this, e);
				if ( !this.responseText ) {
					return callback(false);
				}

				try {
					var data = JSON.parse(this.responseText);
					callback(data);
				}
				catch (ex) {
					return callback(false);
				}
			});
			xhr.onerror = rweb.ui.drive.wrapError('download');
			xhr.send();
		}
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
};
