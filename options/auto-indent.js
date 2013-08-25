
/**
 * http://jsfiddle.net/rudiedirkx/WwCe3/show/
**/

function doAutoIndent(textarea, indent) {
	indent || (indent = "\t");

	function str_repeat(str, n) {
		var out = '';
		while (n--) out += str;
		return out;
	}

	function isIndented(line) {
		var regex = new RegExp('^(' + indent + '+)', 'g'),
			match = line.match(regex);
		return match && match[0].length / indent.length || 0;
	}

	function addIndent(ta, before, after, num) {
		num = num ? ~~num : 1;
		ta._lastValue = ta.value = before + str_repeat(indent, num) + after;
		ta.selectionStart = ta.selectionEnd = before.length + indent.length * num;
	}

	function removeIndent(ta, before, after) {
		ta._lastValue = ta.value = before.slice(0, -1-indent.length) + '}' + after;
		ta.selectionStart = ta.selectionEnd = before.length-indent;
	}

	function getPrevLine(ta, before) {
		var lines = ta.value.split(/\n/g),
			line = before.trimRight().split(/\n/g).length - 1;
		return lines[line] || '';
	}

	function onKeyUp(e) {
		var lastValue = this._lastValue === undefined ? this.defaultValue : this._lastValue,
			change = this.value.length - lastValue.length;
		this._lastValue = this.value;
		if ( !change ) {
			return;
		}

		var caret = this.selectionStart,
			added = change > 0 && this.value.substr(caret - change, change) || '',
			removed = change < 0 && lastValue.substr(caret, -change) || '';

		var code = e.keyCode;
		var value = this.value,
			before = value.substr(0, caret),
			after = value.substr(caret),
			lastChar = before.trim().slice(-1);

		// ENTER
		if ( code == 13 ) {
			// Immediately after a {
			if ( lastChar == '{' ) {
				var prevLine = getPrevLine(this, before),
					indents = isIndented(prevLine);
				return addIndent(this, before, after, indents+1);
			}

			// After an indented line
			var prevLine = getPrevLine(this, before),
				indents = isIndented(prevLine);
			if ( indents > 0 ) {
				addIndent(this, before, after, indents);
			}
		}
		else if ( added == '}' ) {
			removeIndent(this, before, after);
		}
	}

	textarea.addEventListener('keyup', onKeyUp, false);
}
