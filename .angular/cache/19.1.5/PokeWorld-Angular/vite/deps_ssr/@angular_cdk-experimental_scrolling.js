import { createRequire } from 'module';const require = createRequire(import.meta.url);
import {
  VIRTUAL_SCROLL_STRATEGY,
  coerceNumberProperty
} from "./chunk-67NUBQTO.js";
import "./chunk-DDFAXYV6.js";
import "./chunk-XXWZTTGF.js";
import {
  Directive,
  Input,
  NgModule,
  forwardRef,
  setClassMetadata,
  ɵɵNgOnChangesFeature,
  ɵɵProvidersFeature,
  ɵɵdefineDirective,
  ɵɵdefineInjector,
  ɵɵdefineNgModule
} from "./chunk-WQIVPHHD.js";
import "./chunk-WBQSER3X.js";
import {
  require_cjs
} from "./chunk-TDK5NIWS.js";
import "./chunk-RK6XMIZN.js";
import {
  __toESM
} from "./chunk-YHCV7DAQ.js";

// node_modules/@angular/cdk-experimental/fesm2022/scrolling.mjs
var import_rxjs = __toESM(require_cjs(), 1);
var ItemSizeAverager = class {
  /** The total amount of weight behind the current average. */
  _totalWeight = 0;
  /** The current average item size. */
  _averageItemSize;
  /** The default size to use for items when no data is available. */
  _defaultItemSize;
  /** @param defaultItemSize The default size to use for items when no data is available. */
  constructor(defaultItemSize = 50) {
    this._defaultItemSize = defaultItemSize;
    this._averageItemSize = defaultItemSize;
  }
  /** Returns the average item size. */
  getAverageItemSize() {
    return this._averageItemSize;
  }
  /**
   * Adds a measurement sample for the estimator to consider.
   * @param range The measured range.
   * @param size The measured size of the given range in pixels.
   */
  addSample(range, size) {
    const newTotalWeight = this._totalWeight + range.end - range.start;
    if (newTotalWeight) {
      const newAverageItemSize = (size + this._averageItemSize * this._totalWeight) / newTotalWeight;
      if (newAverageItemSize) {
        this._averageItemSize = newAverageItemSize;
        this._totalWeight = newTotalWeight;
      }
    }
  }
  /** Resets the averager. */
  reset() {
    this._averageItemSize = this._defaultItemSize;
    this._totalWeight = 0;
  }
};
var AutoSizeVirtualScrollStrategy = class {
  /** @docs-private Implemented as part of VirtualScrollStrategy. */
  scrolledIndexChange = new import_rxjs.Observable(() => {
    if (typeof ngDevMode === "undefined" || ngDevMode) {
      throw Error("cdk-virtual-scroll: scrolledIndexChange is currently not supported for the autosize scroll strategy");
    }
  });
  /** The attached viewport. */
  _viewport = null;
  /** The minimum amount of buffer rendered beyond the viewport (in pixels). */
  _minBufferPx;
  /** The number of buffer items to render beyond the edge of the viewport (in pixels). */
  _maxBufferPx;
  /** The estimator used to estimate the size of unseen items. */
  _averager;
  /** The last measured scroll offset of the viewport. */
  _lastScrollOffset;
  /** The last measured size of the rendered content in the viewport. */
  _lastRenderedContentSize;
  /** The last measured size of the rendered content in the viewport. */
  _lastRenderedContentOffset;
  /**
   * The number of consecutive cycles where removing extra items has failed. Failure here means that
   * we estimated how many items we could safely remove, but our estimate turned out to be too much
   * and it wasn't safe to remove that many elements.
   */
  _removalFailures = 0;
  /**
   * @param minBufferPx The minimum amount of buffer rendered beyond the viewport (in pixels).
   *     If the amount of buffer dips below this number, more items will be rendered.
   * @param maxBufferPx The number of pixels worth of buffer to shoot for when rendering new items.
   *     If the actual amount turns out to be less it will not necessarily trigger an additional
   *     rendering cycle (as long as the amount of buffer is still greater than `minBufferPx`).
   * @param averager The averager used to estimate the size of unseen items.
   */
  constructor(minBufferPx, maxBufferPx, averager = new ItemSizeAverager()) {
    this._minBufferPx = minBufferPx;
    this._maxBufferPx = maxBufferPx;
    this._averager = averager;
  }
  /**
   * Attaches this scroll strategy to a viewport.
   * @param viewport The viewport to attach this strategy to.
   */
  attach(viewport) {
    this._averager.reset();
    this._viewport = viewport;
    this._renderContentForCurrentOffset();
  }
  /** Detaches this scroll strategy from the currently attached viewport. */
  detach() {
    this._viewport = null;
  }
  /** @docs-private Implemented as part of VirtualScrollStrategy. */
  onContentScrolled() {
    if (this._viewport) {
      this._updateRenderedContentAfterScroll();
    }
  }
  /** @docs-private Implemented as part of VirtualScrollStrategy. */
  onDataLengthChanged() {
    if (this._viewport) {
      this._renderContentForCurrentOffset();
      this._checkRenderedContentSize();
    }
  }
  /** @docs-private Implemented as part of VirtualScrollStrategy. */
  onContentRendered() {
    if (this._viewport) {
      this._checkRenderedContentSize();
    }
  }
  /** @docs-private Implemented as part of VirtualScrollStrategy. */
  onRenderedOffsetChanged() {
    if (this._viewport) {
      this._checkRenderedContentOffset();
    }
  }
  /** Scroll to the offset for the given index. */
  scrollToIndex() {
    if (typeof ngDevMode === "undefined" || ngDevMode) {
      throw Error("cdk-virtual-scroll: scrollToIndex is currently not supported for the autosize scroll strategy");
    }
  }
  /**
   * Update the buffer parameters.
   * @param minBufferPx The minimum amount of buffer rendered beyond the viewport (in pixels).
   * @param maxBufferPx The number of buffer items to render beyond the edge of the viewport (in
   *     pixels).
   */
  updateBufferSize(minBufferPx, maxBufferPx) {
    if (maxBufferPx < minBufferPx) {
      throw Error("CDK virtual scroll: maxBufferPx must be greater than or equal to minBufferPx");
    }
    this._minBufferPx = minBufferPx;
    this._maxBufferPx = maxBufferPx;
  }
  /** Update the rendered content after the user scrolls. */
  _updateRenderedContentAfterScroll() {
    const viewport = this._viewport;
    const scrollOffset = viewport.measureScrollOffset();
    let scrollDelta = scrollOffset - this._lastScrollOffset;
    let scrollMagnitude = Math.abs(scrollDelta);
    const renderedRange = viewport.getRenderedRange();
    let offsetCorrection = 0;
    if (scrollDelta < 0) {
      const predictedOffset = renderedRange.start * this._averager.getAverageItemSize();
      const offsetDifference = predictedOffset - this._lastRenderedContentOffset;
      offsetCorrection = Math.round(offsetDifference * Math.max(0, Math.min(1, scrollMagnitude / (scrollOffset + scrollMagnitude))));
      scrollDelta = scrollDelta - offsetCorrection;
      scrollMagnitude = Math.abs(scrollDelta);
    }
    const startBuffer = this._lastScrollOffset - this._lastRenderedContentOffset;
    const endBuffer = this._lastRenderedContentOffset + this._lastRenderedContentSize - (this._lastScrollOffset + viewport.getViewportSize());
    const underscan = scrollMagnitude + this._minBufferPx - (scrollDelta < 0 ? startBuffer : endBuffer);
    if (underscan > 0) {
      if (scrollMagnitude >= viewport.getViewportSize()) {
        this._renderContentForCurrentOffset();
      } else {
        const addItems = Math.max(0, Math.ceil((underscan - this._minBufferPx + this._maxBufferPx) / this._averager.getAverageItemSize()));
        const overscan = (scrollDelta < 0 ? endBuffer : startBuffer) - this._minBufferPx + scrollMagnitude;
        const unboundedRemoveItems = Math.floor(overscan / this._averager.getAverageItemSize() / (this._removalFailures + 1));
        const removeItems = Math.min(renderedRange.end - renderedRange.start, Math.max(0, unboundedRemoveItems));
        const range = this._expandRange(renderedRange, scrollDelta < 0 ? addItems : 0, scrollDelta > 0 ? addItems : 0);
        if (scrollDelta < 0) {
          range.end = Math.max(range.start + 1, range.end - removeItems);
        } else {
          range.start = Math.min(range.end - 1, range.start + removeItems);
        }
        let contentOffset;
        let contentOffsetTo;
        if (scrollDelta < 0) {
          let removedSize = viewport.measureRangeSize({
            start: range.end,
            end: renderedRange.end
          });
          if (removedSize <= overscan) {
            contentOffset = this._lastRenderedContentOffset + this._lastRenderedContentSize - removedSize;
            this._removalFailures = 0;
          } else {
            range.end = renderedRange.end;
            contentOffset = this._lastRenderedContentOffset + this._lastRenderedContentSize;
            this._removalFailures++;
          }
          contentOffsetTo = "to-end";
        } else {
          const removedSize = viewport.measureRangeSize({
            start: renderedRange.start,
            end: range.start
          });
          if (removedSize <= overscan) {
            contentOffset = this._lastRenderedContentOffset + removedSize;
            this._removalFailures = 0;
          } else {
            range.start = renderedRange.start;
            contentOffset = this._lastRenderedContentOffset;
            this._removalFailures++;
          }
          contentOffsetTo = "to-start";
        }
        viewport.setRenderedRange(range);
        viewport.setRenderedContentOffset(contentOffset + offsetCorrection, contentOffsetTo);
      }
    } else if (offsetCorrection) {
      viewport.setRenderedContentOffset(this._lastRenderedContentOffset + offsetCorrection);
    }
    this._lastScrollOffset = scrollOffset;
  }
  /**
   * Checks the size of the currently rendered content and uses it to update the estimated item size
   * and estimated total content size.
   */
  _checkRenderedContentSize() {
    const viewport = this._viewport;
    this._lastRenderedContentSize = viewport.measureRenderedContentSize();
    this._averager.addSample(viewport.getRenderedRange(), this._lastRenderedContentSize);
    this._updateTotalContentSize(this._lastRenderedContentSize);
  }
  /** Checks the currently rendered content offset and saves the value for later use. */
  _checkRenderedContentOffset() {
    const viewport = this._viewport;
    this._lastRenderedContentOffset = viewport.getOffsetToRenderedContentStart();
  }
  /**
   * Recalculates the rendered content based on our estimate of what should be shown at the current
   * scroll offset.
   */
  _renderContentForCurrentOffset() {
    const viewport = this._viewport;
    const scrollOffset = viewport.measureScrollOffset();
    this._lastScrollOffset = scrollOffset;
    this._removalFailures = 0;
    const itemSize = this._averager.getAverageItemSize();
    const firstVisibleIndex = Math.min(viewport.getDataLength() - 1, Math.floor(scrollOffset / itemSize));
    const bufferSize = Math.ceil(this._maxBufferPx / itemSize);
    const range = this._expandRange(this._getVisibleRangeForIndex(firstVisibleIndex), bufferSize, bufferSize);
    viewport.setRenderedRange(range);
    viewport.setRenderedContentOffset(itemSize * range.start);
  }
  // TODO: maybe move to base class, can probably share with fixed size strategy.
  /**
   * Gets the visible range of data for the given start index. If the start index is too close to
   * the end of the list it may be backed up to ensure the estimated size of the range is enough to
   * fill the viewport.
   * Note: must not be called if `this._viewport` is null
   * @param startIndex The index to start the range at
   * @return a range estimated to be large enough to fill the viewport when rendered.
   */
  _getVisibleRangeForIndex(startIndex) {
    const viewport = this._viewport;
    const range = {
      start: startIndex,
      end: startIndex + Math.ceil(viewport.getViewportSize() / this._averager.getAverageItemSize())
    };
    const extra = range.end - viewport.getDataLength();
    if (extra > 0) {
      range.start = Math.max(0, range.start - extra);
    }
    return range;
  }
  // TODO: maybe move to base class, can probably share with fixed size strategy.
  /**
   * Expand the given range by the given amount in either direction.
   * Note: must not be called if `this._viewport` is null
   * @param range The range to expand
   * @param expandStart The number of items to expand the start of the range by.
   * @param expandEnd The number of items to expand the end of the range by.
   * @return The expanded range.
   */
  _expandRange(range, expandStart, expandEnd) {
    const viewport = this._viewport;
    const start = Math.max(0, range.start - expandStart);
    const end = Math.min(viewport.getDataLength(), range.end + expandEnd);
    return {
      start,
      end
    };
  }
  /** Update the viewport's total content size. */
  _updateTotalContentSize(renderedContentSize) {
    const viewport = this._viewport;
    const renderedRange = viewport.getRenderedRange();
    const totalSize = renderedContentSize + (viewport.getDataLength() - (renderedRange.end - renderedRange.start)) * this._averager.getAverageItemSize();
    viewport.setTotalContentSize(totalSize);
  }
};
function _autoSizeVirtualScrollStrategyFactory(autoSizeDir) {
  return autoSizeDir._scrollStrategy;
}
var CdkAutoSizeVirtualScroll = class _CdkAutoSizeVirtualScroll {
  /**
   * The minimum amount of buffer rendered beyond the viewport (in pixels).
   * If the amount of buffer dips below this number, more items will be rendered. Defaults to 100px.
   */
  get minBufferPx() {
    return this._minBufferPx;
  }
  set minBufferPx(value) {
    this._minBufferPx = coerceNumberProperty(value);
  }
  _minBufferPx = 100;
  /**
   * The number of pixels worth of buffer to shoot for when rendering new items.
   * If the actual amount turns out to be less it will not necessarily trigger an additional
   * rendering cycle (as long as the amount of buffer is still greater than `minBufferPx`).
   * Defaults to 200px.
   */
  get maxBufferPx() {
    return this._maxBufferPx;
  }
  set maxBufferPx(value) {
    this._maxBufferPx = coerceNumberProperty(value);
  }
  _maxBufferPx = 200;
  /** The scroll strategy used by this directive. */
  _scrollStrategy = new AutoSizeVirtualScrollStrategy(this.minBufferPx, this.maxBufferPx);
  ngOnChanges() {
    this._scrollStrategy.updateBufferSize(this.minBufferPx, this.maxBufferPx);
  }
  static ɵfac = function CdkAutoSizeVirtualScroll_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _CdkAutoSizeVirtualScroll)();
  };
  static ɵdir = ɵɵdefineDirective({
    type: _CdkAutoSizeVirtualScroll,
    selectors: [["cdk-virtual-scroll-viewport", "autosize", ""]],
    inputs: {
      minBufferPx: "minBufferPx",
      maxBufferPx: "maxBufferPx"
    },
    features: [ɵɵProvidersFeature([{
      provide: VIRTUAL_SCROLL_STRATEGY,
      useFactory: _autoSizeVirtualScrollStrategyFactory,
      deps: [forwardRef(() => _CdkAutoSizeVirtualScroll)]
    }]), ɵɵNgOnChangesFeature]
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(CdkAutoSizeVirtualScroll, [{
    type: Directive,
    args: [{
      selector: "cdk-virtual-scroll-viewport[autosize]",
      providers: [{
        provide: VIRTUAL_SCROLL_STRATEGY,
        useFactory: _autoSizeVirtualScrollStrategyFactory,
        deps: [forwardRef(() => CdkAutoSizeVirtualScroll)]
      }]
    }]
  }], null, {
    minBufferPx: [{
      type: Input
    }],
    maxBufferPx: [{
      type: Input
    }]
  });
})();
var ScrollingModule = class _ScrollingModule {
  static ɵfac = function ScrollingModule_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ScrollingModule)();
  };
  static ɵmod = ɵɵdefineNgModule({
    type: _ScrollingModule,
    imports: [CdkAutoSizeVirtualScroll],
    exports: [CdkAutoSizeVirtualScroll]
  });
  static ɵinj = ɵɵdefineInjector({});
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ScrollingModule, [{
    type: NgModule,
    args: [{
      imports: [CdkAutoSizeVirtualScroll],
      exports: [CdkAutoSizeVirtualScroll]
    }]
  }], null, null);
})();
export {
  AutoSizeVirtualScrollStrategy,
  CdkAutoSizeVirtualScroll,
  ItemSizeAverager,
  ScrollingModule,
  _autoSizeVirtualScrollStrategyFactory
};
//# sourceMappingURL=@angular_cdk-experimental_scrolling.js.map
