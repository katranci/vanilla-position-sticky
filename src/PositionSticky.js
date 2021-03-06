/**
 * @namespace PositionSticky
 * @author Ahmet Katrancı <ahmet@katranci.co.uk>
 */
var Container   = require('../src/Container');
var Placeholder = require('../src/Placeholder');
var Sticky      = require('../src/Sticky');
var rAF         = require('raf');

var PositionSticky = {

  /**
   * @constant
   */
  POS_SCHEME_STATIC:   100,

  /**
   * @constant
   */
  POS_SCHEME_FIXED:    200,

  /**
   * @constant
   */
  POS_SCHEME_ABSOLUTE: 300,

  /**
   * Creates an instance of PositionSticky
   *
   * @param element
   * @param options
   * @returns {PositionSticky}
   * @static
   * @public
   */
  create: function(element, options) {
    if (typeof options === 'undefined') {
      options = {};
    }
    return Object.create(PositionSticky)._init(element, options);
  },

  /**
   * Constructor method
   *
   * @param element {HTMLElement}
   * @param options {Object}
   * @returns {PositionSticky}
   * @instance
   * @private
   */
  _init: function(element, options) {
    this.constructor = PositionSticky;
    this._window = window;
    this._sticky = Sticky.create(element);
    this._container = Container.create(element.parentNode);
    this._placeholder = null;
    this._posScheme = PositionSticky.POS_SCHEME_STATIC;
    this._isTicking = false;
    this._threshold = null;
    this._options = options;
    this._leftPositionWhenAbsolute = null;
    this._leftPositionWhenFixed = null;
    this._latestKnownScrollY = this._window.pageYOffset;

    this._setOffsetTop();
    this._setOffsetBottom();
    this._calcThreshold();
    this._setLeftPositionWhenAbsolute();
    this._setLeftPositionWhenFixed();
    this._createPlaceholder();
    this._subscribeToWindowScroll();

    return this;
  },

  /**
   * Sets the distance that the sticky element will have from the top of viewport
   * when it becomes sticky
   *
   * @instance
   * @private
   */
  _setOffsetTop: function() {
    if (typeof this._options.offsetTop === 'number' && this._options.offsetTop >= 0) {
      this.offsetTop = this._options.offsetTop;
    } else {
      this.offsetTop = this._container.borderTopWidth + this._container.paddingTop;
    }
  },

  /**
   * Sets the amount to subtract in #_canStickyFitInContainer and also sets the
   * distance that the sticky element will have from the bottom of its container
   * when it is positioned absolutely
   *
   * @instance
   * @private
   */
  _setOffsetBottom: function() {
    this.offsetBottom = this._container.borderBottomWidth + this._container.paddingBottom;
  },

  /**
   * Calculates the point where the sticky behaviour should start
   *
   * @instance
   * @private
   */
  _calcThreshold: function() {
    this._threshold = this._getStickyDistanceFromDocumentTop() - this.offsetTop;
  },

  /**
   * Gets the element's distance from its offset parent's left
   * and subtracts any horizontal margins and saves it
   *
   * @instance
   * @private
   */
  _setLeftPositionWhenAbsolute: function() {
    var marginLeft = parseInt(this._window.getComputedStyle(this._sticky.element).marginLeft, 10);
    this._leftPositionWhenAbsolute = this._sticky.element.offsetLeft - marginLeft;
  },

  /**
   * Gets the element's distance from document left and saves it
   *
   * @instance
   * @private
   *
   * @todo Write a test that is covering when the page is scrolled
   */
  _setLeftPositionWhenFixed: function() {
    var marginLeft = parseInt(this._window.getComputedStyle(this._sticky.element).marginLeft, 10);
    this._leftPositionWhenFixed = this._window.pageXOffset + this._sticky.element.getBoundingClientRect().left - marginLeft;
  },

  /**
   * Creates the placeholder that will be used in place of the element
   * when the element is positioned absolutely or fixed
   *
   * @instance
   * @private
   */
  _createPlaceholder: function() {
    this._placeholder = Placeholder.create(this._sticky);
  },

  /**
   * Attaches #_onScroll method to Window.onscroll event
   *
   * @instance
   * @private
   */
  _subscribeToWindowScroll: function() {
    this._window.addEventListener('scroll', this._onScroll.bind(this));
  },

  /**
   * Debounces the scroll event
   *
   * @see [Debouncing Scroll Events]{@link http://www.html5rocks.com/en/tutorials/speed/animations/#debouncing-scroll-events}
   * @instance
   * @private
   *
   * @todo Don't run _update when container is not visible
   */
  _onScroll: function() {
    if (!this._isTicking) {
      this._latestKnownScrollY = this._window.pageYOffset;
      rAF(this._update.bind(this));
      this._isTicking = true;
    }
  },

  /**
   * @returns {boolean}
   * @instance
   * @private
   */
  _isStatic: function() {
    return this._posScheme === PositionSticky.POS_SCHEME_STATIC;
  },

  /**
   * @instance
   * @private
   */
  _makeStatic: function() {
    this._sticky.element.style.position = 'static';
    this._placeholder.element.style.display = 'none';
    this._posScheme = PositionSticky.POS_SCHEME_STATIC;
  },

  /**
   * @returns {boolean}
   * @instance
   * @private
   */
  _isFixed: function() {
    return this._posScheme === PositionSticky.POS_SCHEME_FIXED;
  },

  /**
   * @instance
   * @private
   */
  _makeFixed: function() {
    this._sticky.element.style.bottom = null;
    this._sticky.element.style.position = 'fixed';
    this._sticky.element.style.top = this.offsetTop + 'px';
    this._sticky.element.style.left = this._leftPositionWhenFixed + 'px';
    this._placeholder.element.style.display = 'block';
    this._posScheme = PositionSticky.POS_SCHEME_FIXED;
  },

  /**
   * @returns {boolean}
   * @instance
   * @private
   */
  _isAbsolute: function() {
    return this._posScheme === PositionSticky.POS_SCHEME_ABSOLUTE;
  },

  /**
   * @instance
   * @private
   */
  _makeAbsolute: function() {
    this._sticky.element.style.top = null;
    this._sticky.element.style.position = 'absolute';
    this._sticky.element.style.bottom = this._container.paddingBottom + 'px';
    this._sticky.element.style.left = this._leftPositionWhenAbsolute + 'px';
    this._placeholder.element.style.display = 'block';
    this._posScheme = PositionSticky.POS_SCHEME_ABSOLUTE;
  },

  /**
   * This is the main method that runs on every animation frame during scroll.
   * It starts with checking whether the element is within the static range.
   * If not, it checks whether the element is within the fixed range.
   * Otherwise, it positions the element absolutely.
   *
   * @instance
   * @private
   */
  _update: function() {
    this._isTicking = false;

    if (this._isBelowThreshold()) {
      if (!this._isStatic()) {
        this._makeStatic();
      }
    } else if (this._canStickyFitInContainer()) {
      if (!this._isFixed()) {
        this._makeFixed();
      }
    } else {
      if (!this._isAbsolute()) {
        this._makeAbsolute();
      }
    }
  },

  /**
   * Returns true when the page hasn't been scrolled to the threshold point yet.
   * Otherwise, returns false.
   *
   * @returns {boolean}
   * @instance
   * @private
   */
  _isBelowThreshold: function() {
    if (this._latestKnownScrollY < this._threshold) {
      return true;
    }
    return false;
  },

  /**
   * Checks whether the element can fit inside the visible portion of the container or not
   *
   * @returns {boolean}
   * @instance
   * @private
   */
  _canStickyFitInContainer: function() {
    return this._getAvailableSpaceInContainer() >= this._sticky.boundingBoxHeight;
  },

  /**
   * Calculates the height of the visible portion of the container
   * that can be used to fit the sticky element
   *
   * @returns {number}
   * @instance
   * @private
   */
  _getAvailableSpaceInContainer: function() {
    return this._container.element.getBoundingClientRect().bottom - this.offsetBottom - this.offsetTop;
  },

  /**
   * Calculates sticky element's total offset from the document top.
   * It uses placeholder if it is called when the sticky element is
   * not static (e.g. through #refresh)
   *
   * @returns {number}
   * @instance
   * @private
   */
  _getStickyDistanceFromDocumentTop: function() {
    var element = (this._isStatic() ? this._sticky.element : this._placeholder.element);
    var totalOffsetTop = this._latestKnownScrollY + element.getBoundingClientRect().top;
    return totalOffsetTop;
  },

  /**
   * Re-measures the cached positions/dimensions that are used during scroll
   *
   * @instance
   * @public
   */
  refresh: function() {
    this._calcThreshold();
    this._sticky.refresh();
    this._placeholder.refresh();
  }

};

module.exports = PositionSticky;