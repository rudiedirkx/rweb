// http://rudiedirkx.github.io/rjs/build.html#-ifsetor,-array_intersect,-array_diff,-_classlist,-anyevent_summary,-event_custom_directchange,-element_attr2method,-element_attr2method_html,-element_attr2method_text
// f185ebc25a44f16d57a3eb399d3730f9a773424b

(function(W, D) {

	"use strict";

	var html = D.documentElement,
		head = html.getElementsByTagName('head')[0];

	var r = function r( id, sel ) {
		return r.$(id, sel);
	};

	JSON.encode = JSON.stringify;
	JSON.decode = JSON.parse;
	var domReadyAttached = false;
	var cssDisplays = {};
	r.arrayish = function(obj) {
		return obj instanceof Array || ( typeof obj.length == 'number' && typeof obj != 'string' && ( obj[0] !== undefined || obj.length === 0 ) );
	};

	r.array = function(list) {
		var arr = [];
		r.each(list, function(el, i) {
			arr.push(el);
		});
		return arr;
	};
	r.class = function(obj) {
		var code = String(obj.constructor);
		return code.match(/ (.+?)[\(\]]/)[1];
	};
	r.is_a = function(obj, type) {
		return W[type] && obj instanceof W[type];
	};
	r.serialize = function(o, prefix) {
		var q = [];
		r.each(o, function(v, k) {
			var name = prefix ? prefix + '[' + k + ']' : k,
			v = o[k];
			if ( typeof v == 'object' ) {
				q.push(r.serialize(v, name));
			}
			else {
				q.push(name + '=' + encodeURIComponent(v));
			}
		});
		return q.join('&');
	};
	r.copy = function(obj) {
		return JSON.parse(JSON.stringify(obj));
	};
	r.merge = function(base) {
		var merger = function(value, name) {
			base[name] = value;
		};
		for ( var i=1, L=arguments.length; i<L; i++ ) {
			r.each(arguments[i], merger);
		}
		return base;
	};
	r.each = function(source, callback, context) {
		if ( r.arrayish(source) ) {
			for ( var i=0, L=source.length; i<L; i++ ) {
				callback.call(context, source[i], i, source);
			}
		}
		else {
			for ( var k in source ) {
				if ( source.hasOwnProperty(k) ) {
					callback.call(context, source[k], k, source);
				}
			}
		}

		return source;
	};

	r.extend = function(Hosts, proto, Super) {
		if ( !(Hosts instanceof Array) ) {
			Hosts = [Hosts];
		}

		r.each(Hosts, function(Host) {
			if ( Super ) {
				Host.prototype = Super;
				Host.prototype.constructor = Host;
			}

			var methodOwner = Host.prototype ? Host.prototype : Host;
			r.each(proto, function(fn, name) {
				methodOwner[name] = fn;

				if ( Host == Element && !Elements.prototype[name] ) {
					Elements.prototype[name] = function() {
						return this.invoke(name, arguments);
					};
				}
			});
		});
	};

	r.getter = function(Host, prop, getter) {
		Object.defineProperty(Host.prototype, prop, {get: getter});
	};
	r.extend(Array, {
		invoke: function(method, args) {
			var results = [];
			this.forEach(function(el) {
				results.push( el[method].apply(el, args) );
			});
			return results;
		},
		contains: function(obj) {
			return this.indexOf(obj) != -1;
		},
		unique: function() {
			var els = [];
			this.forEach(function(el) {
				if ( !els.contains(el) ) {
					els.push(el);
				}
			});
			return els;
		},
		each: Array.prototype.forEach,
		first: function() {
			return this[0];
		},
		last: function() {
			return this[this.length-1];
		}
	});
	Array.defaultFilterCallback = function(item) {
		return !!item;
	};
	r.extend(String, {
		camel: function() {
			return this.replace(/\-([^\-])/g, function(a, m) {
				return m.toUpperCase();
			});
		},
		uncamel: function() {
			return this.replace(/([A-Z])/g, function(a, m) {
				return '-' + m.toLowerCase();
			});
		},
		repeat: function(num) {
			return new Array(num+1).join(this);
		}
	});

	var indexOf = [].indexOf;

	r.js = function(src) {
		if ( r.arrayish(src) ) {
			var evt = new Eventable(src),
				need = src.length,
				have = 0,
				onLoad = function(e) {
					if ( ++have == need ) {
						evt.fire('load', e);
					}
				},
				onError = function(e) {
					evt.fire('error', e);
				};
			src.forEach(function(url) {
				r.js(url).on('load', onLoad).on('error', onError);
			});
			return evt;
		}

		return D.el('script', {src: src, type: 'text/javascript'}).inject(head);
	};
	function Elements(source, selector) {
		this.length = 0;
		if ( source ) {
			r.each(source, function(el, i) {
				if ( el.nodeType === 1 && ( !selector || el.is(selector) ) ) {
					this.push(el);
				}
			}, this);
		}
	}
	r.extend(Elements, {
		invoke: function(method, args) {
			var returnSelf = false,
				res = [],
				isElements = false;
			r.each(this, function(el, i) {
				var retEl = el[method].apply(el, args);
				res.push( retEl );
				if ( retEl == el ) returnSelf = true;
				if ( retEl instanceof Element ) isElements = true;
			});
			return returnSelf ? this : ( isElements || !res.length ? new Elements(res) : res );
		},
		filter: function(filter) {
			if ( typeof filter == 'function' ) {
				return new Elements([].filter.call(this, filter));
			}
			return new Elements(this, filter);
		}
	}, new Array);
	function Coords2D(x, y) {
		this.x = parseFloat(x);
		this.y = parseFloat(y);
	}
	r.extend(Coords2D, {
		add: function(coords) {
			return new Coords2D(this.x + coords.x, this.y + coords.y);
		},
		subtract: function(coords) {
			return new Coords2D(this.x - coords.x, this.y - coords.y);
		},
		toCSS: function() {
			return {
				left: this.x + 'px',
				top: this.y + 'px'
			};
		},
		join: function(glue) {
			if ( glue == null ) {
				glue = ',';
			}
			return [this.x, this.y].join(glue);
		},
		equal: function(coord) {
			return this.join() == coord.join();
		}
	});
	function AnyEvent(e) {
		if ( typeof e == 'string' ) {
			this.originalEvent = null;
			e = {"type": e, "target": null};
		}
		else {
			this.originalEvent = e;
		}

		this.type = e.type;
		this.target = e.target || e.srcElement;
		this.relatedTarget = e.relatedTarget;
		this.fromElement = e.fromElement;
		this.toElement = e.toElement;
		this.key = e.keyCode || e.which;
		this.alt = e.altKey;
		this.ctrl = e.ctrlKey;
		this.shift = e.shiftKey;
		this.button = e.button || e.which;
		this.leftClick = this.button == 1;
		this.rightClick = this.button == 2;
		this.middleClick = this.button == 4 || this.button == 1 && this.key == 2;
		this.leftClick = this.leftClick && !this.middleClick;
		this.which = this.key || this.button;
		this.detail = e.detail;

		this.pageX = e.pageX;
		this.pageY = e.pageY;
		this.clientX = e.clientX;
		this.clientY = e.clientY;

		this.touches = e.touches ? r.array(e.touches) : null;

		if ( this.touches && this.touches[0] ) {
			this.pageX = this.touches[0].pageX;
			this.pageY = this.touches[0].pageY;
		}
		if ( this.pageX != null && this.pageY != null ) {
			this.pageXY = new Coords2D(this.pageX, this.pageY);
		}
		else if ( this.clientX != null && this.clientY != null ) {
			this.pageXY = new Coords2D(this.clientX, this.clientY).add(W.getScroll());
		}
		this.message = e.message;
		this.data = e.dataTransfer || e.clipboardData;
		this.time = e.timeStamp || e.timestamp || e.time || Date.now();

		this.total = e.total || e.totalSize;
		this.loaded = e.loaded || e.position;
	}
	r.extend(AnyEvent, {
		preventDefault: function(e) {
			if ( e = this.originalEvent ) {
				e.preventDefault();
			}
			this.defaultPrevented = true;
		},
		stopPropagation: function(e) {
			if ( e = this.originalEvent ) {
				e.stopPropagation();
			}
			this.propagationStopped = true;
		},
		stopImmediatePropagation: function(e) {
			this.stopPropagation();

			if ( e = this.originalEvent ) {
				e.stopImmediatePropagation();
			}
			this.immediatePropagationStopped = true;
		},

		setSubject: function(subject) {
			this.subject = subject;
			if ( this.pageXY ) {
				this.subjectXY = this.pageXY;
				if ( this.subject.getPosition ) {
					this.subjectXY = this.subjectXY.subtract(this.subject.getPosition());
				}
			}
		}
	});
	Event.Keys = {enter: 13, up: 38, down: 40, left: 37, right: 39, esc: 27, space: 32, backspace: 8, tab: 9, "delete": 46};
	Event.Custom = {
		mouseenter: {
			type: 'mouseover',
			filter: function(e) {
				return e.fromElement != this && !this.contains(e.fromElement);
			}
		},
		mouseleave: {
			type: 'mouseout',
			filter: function(e) {
				return e.toElement != this && !this.contains(e.toElement);
			}
		},
		mousewheel: {
			type: 'onmousewheel' in W ? 'mousewheel' : 'mousescroll'
		}
	};

	if ( 'onmouseenter' in html ) {
		delete Event.Custom.mouseenter;
	}
	if ( 'onmouseleave' in html ) {
		delete Event.Custom.mouseleave;
	}
	r.each([
		W,
		D,
		Element,
		Elements
	], function(Host) {
		Host.extend = function(methods) {
			r.extend([this], methods);
		};
	});
	function Eventable(subject) {
		this.subject = subject;
		this.time = Date.now();
	}
	r.extend(Eventable, {
		on: function(eventType, matches, callback) {
			if ( !callback ) {
				callback = matches;
				matches = null;
			}

			var options = {
				bubbles: !!matches,
				subject: this || W
			};

			var baseType = eventType,
				customEvent;
			if ( customEvent = Event.Custom[eventType] ) {
				if ( customEvent.type ) {
					baseType = customEvent.type;
				}
			}

			var onCallback = function(e, arg2) {
				if ( e && !(e instanceof AnyEvent) ) {
					e = new AnyEvent(e);
				}

				var subject = options.subject;
				if ( e && e.target && matches ) {
					if ( !(subject = e.target.selfOrAncestor(matches)) ) {
						return;
					}
				}

				if ( customEvent && customEvent.filter ) {
					if ( !customEvent.filter.call(subject, e, arg2) ) {
						return;
					}
				}

				if ( !e.subject ) {
					e.setSubject(subject);
				}
				return callback.call(subject, e, arg2);
			};

			if ( customEvent && customEvent.before ) {
				if ( customEvent.before.call(this, options) === false ) {
					return this;
				}
			}

			var events = options.subject.$events || (options.subject.$events = {});
			events[eventType] || (events[eventType] = []);
			events[eventType].push({
				type: baseType,
				original: callback,
				callback: onCallback,
				bubbles: options.bubbles
			});

			if ( options.subject.addEventListener ) {
				options.subject.addEventListener(baseType, onCallback, options.bubbles);
			}

			return this;
		},
		off: function(eventType, callback) {
			if ( this.$events && this.$events[eventType] ) {
				var events = this.$events[eventType],
					changed = false;
				r.each(events, function(listener, i) {
					if ( !callback || callback == listener.original ) {
						changed = true;
						delete events[i];
						if ( this.removeEventListener ) {
							this.removeEventListener(listener.type, listener.callback, listener.bubbles);
						}
					}
				}, this);
				if ( changed ) {
					this.$events[eventType] = events.filter(Array.defaultFilterCallback);
				}
			}
			return this;
		},
		fire: function(eventType, e, arg2) {
			if ( this.$events && this.$events[eventType] ) {
				if ( !e ) {
					e = new AnyEvent(eventType);
				}
				var immediatePropagationStopped = false;
				r.each(this.$events[eventType], function(listener) {
					if ( !immediatePropagationStopped ) {
						listener.callback.call(this, e, arg2);
						immediatePropagationStopped |= e.immediatePropagationStopped;
					}
				}, this);
			}
			return this;
		},
		globalFire: function(globalType, localType, originalEvent, arg2) {
			var e = originalEvent ? originalEvent : new AnyEvent(localType),
				eventType = (globalType + '-' + localType).camel();
			e.target = e.subject = this;
			e.type = localType;
			e.globalType = globalType;
			W.fire(eventType, e, arg2);
			return this;
		}
	});
	r.extend([W, D, Element, XMLHttpRequest], Eventable.prototype);
	if ( W.XMLHttpRequestUpload ) {
		r.extend([W.XMLHttpRequestUpload], Eventable.prototype);
	}
	r.extend(Node, {
		ancestor: function(selector) {
			var el = this;
			while ( (el = el.parentNode) && el != D ) {
				if ( el.is(selector) ) {
					return el;
				}
			}
		},
		getNext: function(selector) {
			if ( !selector ) {
				return this.nextElementSibling;
			}

			var sibl = this;
			while ( (sibl = sibl.nextElementSibling) && !sibl.is(selector) );
			return sibl;
		},
		getPrev: function(selector) {
			if ( !selector ) {
				return this.previousElementSibling;
			}

			var sibl = this;
			while ( (sibl = sibl.previousElementSibling) && !sibl.is(selector) );
			return sibl;
		},
		remove: function() {
			return this.parentNode.removeChild(this);
		},
		getParent: function() {
			return this.parentNode;
		},
		insertAfter: function(el, ref) {
			var next = ref.nextSibling; 
			if ( next ) {
				return this.insertBefore(el, next);
			}
			return this.appendChild(el);
		},
		nodeIndex: function() {
			return indexOf.call(this.parentNode.childNodes, this);
		}
	});

	r.extend(D, {
		el: function(tagName, attrs) {
			var el = this.createElement(tagName);
			if ( attrs ) {
				el.attr(attrs);
			}
			return el;
		}
	});
	var EP = Element.prototype;
	r.extend(Element, {
		prop: function(name, value) {
			if ( value !== undefined ) {
				this[name] = value;
				return this;
			}

			return this[name];
		},
		is: EP.matches || EP.matchesSelector || EP.webkitMatchesSelector || EP.mozMatchesSelector || EP.msMatchesSelector || function(selector) {
			return $$(selector).contains(this);
		},
		getValue: function(force) {
			if ( !this.disabled || force ) {
				if ( this.nodeName == 'SELECT' && this.multiple ) {
					return [].reduce.call(this.options, function(values, option) {
						if ( option.selected ) {
							values.push(option.value);
						}
						return values;
					}, []);
				}
				else if ( this.type == 'radio' || this.type == 'checkbox' && !this.checked ) {
					return;
				}
				return this.value;
			}
		},
		toQueryString: function() {
			var els = this.getElements('input[name], select[name], textarea[name]'),
				query = [];
			els.forEach(function(el) {
				var value = el.getValue();
				if ( value instanceof Array ) {
					value.forEach(function(val) {
						query.push(el.name + '=' + encodeURIComponent(val));
					});
				}
				else if ( value != null ) {
					query.push(el.name + '=' + encodeURIComponent(value));
				}
			});
			return query.join('&');
		},
		selfOrAncestor: function(selector) {
			return this.is(selector) ? this : this.ancestor(selector);
		},
		getChildren: function(selector) {
			return new Elements(this.children || this.childNodes, selector);
		},
		getFirst: function() {
			if ( this.firstElementChild !== undefined ) {
				return this.firstElementChild;
			}

			return this.getChildren().first();
		},
		getLast: function() {
			if ( this.lastElementChild !== undefined ) {
				return this.lastElementChild;
			}

			return this.getChildren().last();
		},
		attr: function(name, value, prefix) {
			if ( prefix == null ) {
				prefix = '';
			}
			if ( value === undefined ) {
				if ( typeof name == 'string' ) {
					return this.getAttribute(prefix + name);
				}

				r.each(name, function(value, name) {
					if ( value === null ) {
						this.removeAttribute(prefix + name);
					}
					else {
						this.setAttribute(prefix + name, value);
					}
				}, this);
			}
			else if ( value === null ) {
				this.removeAttribute(prefix + name);
			}
			else {
				if ( typeof value == 'function' ) {
					value = value.call(this, this.getAttribute(prefix + name));
				}

				this.setAttribute(prefix + name, value);
			}

			return this;
		},
		data: function(name, value) {
			return this.attr(name, value, 'data-');
		},
		getHTML: function() {
			return this.innerHTML;
		},
		setHTML: function(html) {
			this.innerHTML = html;
			return this;
		},
		getText: function() {
			return this.innerText || this.textContent;
		},
		setText: function(text) {
			this.textContent = this.innerText = text;
			return this;
		},
		getElement: function(selector) {
			return this.querySelector(selector);
		},

		getElements: function(selector) {
			return $$(this.querySelectorAll(selector));
		},
		getElementsByText: function(text, simple) {
			return this.getElements('*').filter(function(el) {
				if ( simple || el.children.length == 0 ) {
					var tc = simple ? el.textContent.trim() : el.textContent;
					return text instanceof RegExp ? text.test(tc) : tc === text;
				}

				return false;
			});
		},
		getElementByText: function(text, simple) {
			return this.getElementsByText(text, simple)[0];
		},
		removeClass: function(token) {
			this.classList.remove(token);
			return this;
		},
		addClass: function(token) {
			this.classList.add(token);
			return this;
		},
		toggleClass: function(token, add) {
			this.classList.toggle.apply(this.classList, arguments);
			return this;
		},
		replaceClass: function(before, after) {
			return this.removeClass(before).addClass(after);
		},
		hasClass: function(token) {
			return this.classList.contains(token);
		},
		injectBefore: function(ref) {
			ref.parentNode.insertBefore(this, ref);
			return this;
		},
		injectAfter: function(ref) {
			ref.parentNode.insertAfter(this, ref);
			return this;
		},
		inject: function(parent) {
			parent.appendChild(this);
			return this;
		},
		appendTo: function(parent) {
			return this.inject(parent); 
		},
		injectTop: function(parent) {
			if ( parent.firstChild ) {
				parent.insertBefore(this, parent.firstChild);
			}
			else {
				parent.appendChild(this);
			}
			return this;
		},
		append: function(child) {
			if ( typeof child == 'string' ) {
				child = D.createTextNode(child);
			}
			this.appendChild(child);
			return this;
		},
		getStyle: function(property) {
			return getComputedStyle(this).getPropertyValue(property);
		},
		css: function(property, value) {
			if ( value === undefined ) {
				if ( typeof property == 'string' ) {
					return this.getStyle(property);
				}

				r.each(property, function(value, name) {
					this.style[name] = value;
				}, this);
				return this;
			}

			this.style[property] = value;
			return this;
		},
		show: function() {
			if ( !cssDisplays[this.nodeName] ) {
				var el = D.el(this.nodeName).inject(this.ownerDocument.body);
				cssDisplays[this.nodeName] = el.getStyle('display');
				el.remove();
			}
			return this.css('display', cssDisplays[this.nodeName]);
		},
		hide: function() {
			return this.css('display', 'none');
		},
		toggle: function(show) {
			if ( show == null ) {
				show = this.getStyle('display') == 'none';
			}

			return show ? this.show() : this.hide();
		},
		empty: function() {
			try {
				this.innerHTML = '';
			}
			catch (ex) {
				while ( this.firstChild ) {
					this.removeChild(this.firstChild);
				}
			}
			return this;
		},
		elementIndex: function() {
			return this.parentNode.getChildren().indexOf(this);
		},
		getPosition: function() {
			var bcr = this.getBoundingClientRect();
			return new Coords2D(bcr.left, bcr.top).add(W.getScroll());
		},
		getScroll: function() {
			return new Coords2D(this.scrollLeft, this.scrollTop);
		}
	});

	r.extend(D, {
		getElement: Element.prototype.getElement,
		getElements: Element.prototype.getElements,
		getElementsByText: Element.prototype.getElementsByText,
		getElementByText: Element.prototype.getElementByText
	});

	r.extend([W, D], {
		getScroll: function() {
			return new Coords2D(
				D.documentElement.scrollLeft || D.body.scrollLeft,
				D.documentElement.scrollTop || D.body.scrollTop
			);
		}
	});
	Event.Custom.ready = {
		before: function() {
			if ( this == D ) {
				if ( !domReadyAttached ) {
					attachDomReady();
				}
			}
		}
	};

	function attachDomReady() {
		domReadyAttached = true;

		D.on('DOMContentLoaded', function(e) {
			this.fire('ready');
		});
	}
	function $(id, selector) {
		if ( typeof id == 'function' ) {
			if ( D.readyState == 'interactive' || D.readyState == 'complete' ) {
				setTimeout(id, 1);
				return D;
			}

			return D.on('ready', id);
		}
		if ( !selector ) {
			return D.getElementById(id);
		}

		return D.getElement(id);
	}

	function $$(selector) {
		return r.arrayish(selector) ? new Elements(selector) : D.getElements(selector);
	}
	function XHR(url, options) {
		var defaults = {
			method: 'GET',
			async: true,
			send: true,
			data: null,
			url: url,
			requester: 'XMLHttpRequest',
			execScripts: true
		};
		options = options ? r.merge({}, defaults, options) : defaults;
		options.method = options.method.toUpperCase();

		var xhr = new XMLHttpRequest;
		xhr.open(options.method, options.url, options.async, options.username, options.password);
		xhr.options = options;
		xhr.on('load', function(e) {
			var success = this.status == 200,
				eventType = success ? 'success' : 'error',
				t = this.responseText;

			try {
				this.responseJSON = (t[0] == '[' || t[0] == '{') && JSON.parse(t);
			}
			catch (ex) {}
			var response = this.responseJSON || t;

			var scripts;

			if ( this.options.execScripts ) {
				scripts = [];
				if ( typeof response == 'string' ) {
					var regex = /<script[^>]*>([\s\S]*?)<\/script>/i,
						script;
					while ( script = response.match(regex) ) {
						response = response.replace(regex, '');
						if ( script = script[1].trim() ) {
							scripts.push(script);
						}
					}
				}
			}

			this.fire(eventType, e, response);
			this.fire('done', e, response);

			if ( this.options.execScripts && scripts && scripts.length ) {
				scripts.forEach(function(code) {
					eval.call(W, code);
				});
			}

			this.globalFire('xhr', eventType, e, response);
			this.globalFire('xhr', 'done', e, response);
		});
		xhr.on('error', function(e) {
			this.fire('done', e);

			this.globalFire('xhr', 'error', e);
			this.globalFire('xhr', 'done', e);
		});
		if ( options.method == 'POST' ) {
			if ( !r.is_a(options.data, 'FormData') ) {
				var encoding = options.encoding ? '; charset=' + encoding : '';
				xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded' + encoding);
			}
		}
		if ( options.send ) {
			if ( options.requester ) {
				xhr.setRequestHeader('X-Requested-With', options.requester);
			}

			xhr.globalFire('xhr', 'start');
			xhr.fire('start');

			if ( options.async ) {
				setTimeout(function() {
					xhr.send(options.data);
				}, 1);
			}
			else {
				xhr.send(options.data);
			}
		}
		return xhr;
	}

	Event.Custom.progress = {
		before: function(options) {
			if ( this instanceof XMLHttpRequest && this.upload ) {
				options.subject = this.upload;
			}
		}
	};

	function shortXHR(method) {
		return function(url, data, options) {
			if ( !options ) {
				options = {};
			}
			options.method = method;
			options.data = data;
			var xhr = XHR(url, options);
			return xhr;
		};
	}
	r.$ = $;
	W.$ = W.r = r;

	r.$$ = $$;
	r.xhr = XHR;
	r.get = shortXHR('get');
	r.post = shortXHR('post');
	W.$$ = $$;
	W.Elements = Elements;
	W.AnyEvent = AnyEvent;
	W.Eventable = Eventable;
	W.Coords2D = Coords2D;
})(this, this.document);

