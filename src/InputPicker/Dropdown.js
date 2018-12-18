// @flow

import * as React from 'react';
import classNames from 'classnames';
import _ from 'lodash';
import InputAutosize from './InputAutosize';
import { getWidth } from 'dom-lib';
import {
  reactToString,
  filterNodesOfTree,
  findNodeOfTree,
  shallowEqual
} from 'rsuite-utils/lib/utils';

import {
  defaultProps,
  prefix,
  getUnhandledProps,
  createChainedFunction,
  tplTransform,
  getDataGroupBy
} from '../utils';

import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuCheckItem,
  getToggleWrapperClassName,
  onMenuKeyDown,
  PickerToggle,
  MenuWrapper,
  PickerToggleTrigger
} from '../_picker';

import InputSearch from './InputSearch';
import Tag from '../Tag';
import type { Placement } from '../utils/TypeDefinition';

type DefaultEvent = SyntheticEvent<*>;
type DefaultEventFunction = (event: DefaultEvent) => void;
type Props = {
  data: any[],
  cacheData?: any[],
  locale: Object,
  classPrefix?: string,
  className?: string,
  container?: HTMLElement | (() => HTMLElement),
  containerPadding?: number,
  block?: boolean,
  toggleComponentClass?: React.ElementType,
  menuClassName?: string,
  menuStyle?: Object,
  menuAutoWidth?: boolean,
  disabled?: boolean,
  disabledItemValues?: any[],
  maxHeight?: number,
  valueKey: string,
  labelKey: string,
  value?: any | any[],
  defaultValue?: any | any[],
  renderMenu?: (menu: React.Node) => React.Node,
  renderMenuItem?: (itemLabel: React.Node, item: Object) => React.Node,
  renderMenuGroup?: (title: React.Node, item: Object) => React.Node,
  renderValue?: (value: any, item: Object, selectedElement: React.Node) => React.Node,
  renderExtraFooter?: () => React.Node,
  onChange?: (value: any, event: DefaultEvent) => void,
  onSelect?: (value: any, item: Object, event: DefaultEvent) => void,
  onGroupTitleClick?: DefaultEventFunction,
  onSearch?: (searchKeyword: string, event: DefaultEvent) => void,
  onOpen?: () => void,
  onClose?: () => void,
  onHide?: () => void,
  onEnter?: Function,
  onEntering?: Function,
  onEntered?: Function,
  onExit?: Function,
  onExiting?: Function,
  onExited?: Function,
  /**
   * group by key in `data`
   */
  groupBy?: any,
  placeholder?: React.Node,
  searchable?: boolean,
  cleanable?: boolean,
  open?: boolean,
  defaultOpen?: boolean,
  placement?: Placement,
  style?: Object,
  creatable?: boolean,
  multi?: boolean
};

type State = {
  data?: any[],
  value?: any | any[],
  // Used to focus the active item  when trigger `onKeydown`
  focusItemValue?: any,
  searchKeyword: string,
  open?: boolean,
  newData: any[],
  maxWidth: number
};

class Dropdown extends React.Component<Props, State> {
  static defaultProps = {
    data: [],
    cacheData: [],
    disabledItemValues: [],
    maxHeight: 320,
    valueKey: 'value',
    labelKey: 'label',
    locale: {
      placeholder: 'Select',
      noResultsText: 'No results found',
      newItem: 'New item',
      createOption: 'Create option "{0}"'
    },
    searchable: true,
    cleanable: true,
    menuAutoWidth: true,
    placement: 'bottomLeft'
  };

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    if (nextProps.data && !shallowEqual(nextProps.data, prevState.data)) {
      return {
        data: nextProps.data,
        focusItemValue: _.get(nextProps, `data.0.${nextProps.valueKey}`)
      };
    }
    return null;
  }

  constructor(props: Props) {
    super(props);

    const { defaultValue, groupBy, valueKey, labelKey, defaultOpen, multi, data } = props;
    const value: any = multi ? defaultValue || [] : defaultValue;
    const focusItemValue = multi ? _.get(value, 0) : defaultValue;

    this.state = {
      data,
      value,
      focusItemValue,
      searchKeyword: '',
      newData: [],
      open: defaultOpen,
      maxWidth: 100
    };

    if (groupBy === valueKey || groupBy === labelKey) {
      throw Error('`groupBy` can not be equal to `valueKey` and `labelKey`');
    }
  }
  componentDidMount() {
    if (this.toggleWrapper) {
      const maxWidth = getWidth(this.toggleWrapper);
      this.setState({ maxWidth });
    }
  }
  getFocusableMenuItems = () => {
    const { labelKey } = this.props;
    const { menuItems } = this.menuContainer;
    if (!menuItems) {
      return [];
    }

    const items = Object.values(menuItems).map((item: any) => item.props.getItemData());
    return filterNodesOfTree(items, item => this.shouldDisplay(item[labelKey]));
  };

  getValue() {
    const { value, multi } = this.props;
    const nextValue = _.isUndefined(value) ? this.state.value : value;

    if (multi) {
      return _.clone(nextValue) || [];
    }
    return nextValue;
  }

  getAllData() {
    const { data } = this.props;
    const { newData } = this.state;
    return [].concat(data, newData);
  }

  getAllDataAndCache() {
    const { cacheData } = this.props;
    const data = this.getAllData();
    return [].concat(data, cacheData);
  }

  getLabelByValue(value: any) {
    const { renderValue, placeholder, valueKey, labelKey } = this.props;
    // Find active `MenuItem` by `value`
    const activeItem = findNodeOfTree(this.getAllDataAndCache(), item =>
      shallowEqual(item[valueKey], value)
    );
    let displayElement = placeholder;

    if (_.get(activeItem, labelKey)) {
      displayElement = _.get(activeItem, labelKey);

      if (renderValue) {
        displayElement = renderValue(value, activeItem, displayElement);
      }
    }

    return {
      isValid: !!activeItem,
      displayElement
    };
  }

  createOption(value: string) {
    const { valueKey, labelKey, groupBy, locale } = this.props;
    if (groupBy) {
      return {
        create: true,
        [groupBy]: locale.newItem,
        [valueKey]: value,
        [labelKey]: value
      };
    }

    return {
      create: true,
      [valueKey]: value,
      [labelKey]: value
    };
  }

  menuContainer = {
    menuItems: null
  };

  bindMenuContainerRef = (ref: React.ElementRef<*>) => {
    this.menuContainer = ref;
  };

  input = null;

  bindInputRef = (ref: React.ElementRef<*>) => {
    this.input = ref;
  };

  focusInput() {
    if (!this.input) return;
    this.input.focus();
  }

  blurInput() {
    if (!this.input) return;
    this.input.blur();
  }

  trigger = null;

  bindTriggerRef = (ref: React.ElementRef<*>) => {
    this.trigger = ref;
  };

  toggleWrapper = null;

  bindToggleWrapperRef = (ref: React.ElementRef<*>) => {
    this.toggleWrapper = ref;
  };

  toggle = null;

  bindToggleRef = (ref: React.ElementRef<*>) => {
    this.toggle = ref;
  };

  getToggleInstance = () => {
    return this.toggle;
  };

  position = null;

  bindPositionRef = (ref: React.ElementRef<*>) => {
    this.position = ref;
  };

  /**
   * Index of keyword  in `label`
   * @param {node} label
   */
  shouldDisplay(label: any, searchKeyword?: string) {
    const word = typeof searchKeyword === 'undefined' ? this.state.searchKeyword : searchKeyword;
    if (!_.trim(word)) {
      return true;
    }

    const keyword = word.toLocaleLowerCase();

    if (typeof label === 'string' || typeof label === 'number') {
      return `${label}`.toLocaleLowerCase().indexOf(keyword) >= 0;
    } else if (React.isValidElement(label)) {
      const nodes = reactToString(label);
      return (
        nodes
          .join('')
          .toLocaleLowerCase()
          .indexOf(keyword) >= 0
      );
    }

    return false;
  }

  findNode(focus: Function) {
    const items = this.getFocusableMenuItems();
    const { valueKey } = this.props;
    const { focusItemValue } = this.state;

    for (let i = 0; i < items.length; i += 1) {
      if (shallowEqual(focusItemValue, items[i][valueKey])) {
        focus(items, i);
        return;
      }
    }

    focus(items, -1);
  }
  focusNextMenuItem = () => {
    const { valueKey } = this.props;
    this.findNode((items, index) => {
      const focusItem = items[index + 1];
      if (!_.isUndefined(focusItem)) {
        this.setState({ focusItemValue: focusItem[valueKey] });
      }
    });
  };
  focusPrevMenuItem = () => {
    const { valueKey } = this.props;
    this.findNode((items, index) => {
      const focusItem = items[index - 1];
      if (!_.isUndefined(focusItem)) {
        this.setState({ focusItemValue: focusItem[valueKey] });
      }
    });
  };

  updatePosition() {
    if (this.position) {
      this.position.updatePosition(true);
    }
  }

  handleKeyDown = (event: SyntheticKeyboardEvent<*>) => {
    if (!this.menuContainer) {
      return;
    }

    const { multi } = this.props;

    onMenuKeyDown(event, {
      down: this.focusNextMenuItem,
      up: this.focusPrevMenuItem,
      enter: multi ? this.selectFocusMenuCheckItem : this.selectFocusMenuItem,
      esc: this.closeDropdown,
      del: multi ? this.removeLastItem : this.handleClean
    });
  };
  handleClick = () => {
    this.focusInput();
  };

  selectFocusMenuItem = (event: DefaultEvent) => {
    const { focusItemValue, searchKeyword } = this.state;
    const { valueKey, data, disabledItemValues } = this.props;
    if (!focusItemValue || !data) {
      return;
    }

    // If the value is disabled in this option, it is returned.
    if (disabledItemValues && disabledItemValues.some(item => item === focusItemValue)) {
      return;
    }

    // Find active `MenuItem` by `value`
    let focusItem = findNodeOfTree(this.getAllData(), item =>
      shallowEqual(item[valueKey], focusItemValue)
    );

    if (!focusItem && focusItemValue === searchKeyword) {
      focusItem = this.createOption(searchKeyword);
    }

    this.setState({ value: focusItemValue, searchKeyword: '' });
    this.handleSelect(focusItemValue, focusItem, event);
    this.handleChange(focusItemValue, event);
    this.closeDropdown();
  };

  selectFocusMenuCheckItem = (event: DefaultEvent) => {
    const { valueKey, disabledItemValues } = this.props;
    const { focusItemValue } = this.state;
    const value: any = this.getValue();
    const data = this.getAllData();

    if (!focusItemValue || !data) {
      return;
    }

    // If the value is disabled in this option, it is returned.
    if (disabledItemValues && disabledItemValues.some(item => item === focusItemValue)) {
      return;
    }

    if (!value.some(v => shallowEqual(v, focusItemValue))) {
      value.push(focusItemValue);
    } else {
      _.remove(value, itemVal => shallowEqual(itemVal, focusItemValue));
    }

    let focusItem: any = data.find(item => shallowEqual(_.get(item, valueKey), focusItemValue));

    if (!focusItem) {
      focusItem = this.createOption(focusItemValue);
    }

    this.setState({ value, searchKeyword: '' }, this.updatePosition);
    this.handleSelect(value, focusItem, event);
    this.handleChange(value, event);
  };

  handleItemSelect = (value: any, item: Object, event: DefaultEvent) => {
    const nextState = {
      value,
      focusItemValue: value,
      searchKeyword: ''
    };
    this.setState(nextState);
    this.handleSelect(value, item, event);
    this.handleChange(value, event);
    this.closeDropdown();
  };

  handleCheckItemSelect = (
    nextItemValue: any,
    item: Object,
    event: DefaultEvent,
    checked: boolean
  ) => {
    const value: any = this.getValue();

    if (checked) {
      value.push(nextItemValue);
    } else {
      _.remove(value, itemVal => shallowEqual(itemVal, nextItemValue));
    }

    const nextState = {
      value,
      searchKeyword: '',
      focusItemValue: nextItemValue
    };

    this.setState(nextState, this.updatePosition);
    this.handleSelect(value, item, event);
    this.handleChange(value, event);
    this.focusInput();
  };

  handleSelect = (value: any, item: Object, event: DefaultEvent) => {
    const { onSelect, creatable } = this.props;
    const { newData } = this.state;

    onSelect && onSelect(value, item, event);

    if (creatable && item.create) {
      delete item.create;
      this.setState({
        newData: newData.concat(item)
      });
    }
  };

  handleSearch = (searchKeyword: string, event: DefaultEvent) => {
    const { onSearch, labelKey, valueKey } = this.props;
    const filteredData = filterNodesOfTree(this.getAllData(), item =>
      this.shouldDisplay(item[labelKey], searchKeyword)
    );
    const nextState = {
      searchKeyword,
      focusItemValue: filteredData.length ? filteredData[0][valueKey] : searchKeyword
    };

    this.setState(nextState, this.updatePosition);

    onSearch && onSearch(searchKeyword, event);
  };

  closeDropdown = () => {
    if (this.trigger) {
      this.trigger.hide();
    }
  };

  handleChange = (value: any, event: DefaultEvent) => {
    const { onChange } = this.props;
    onChange && onChange(value, event);
  };

  handleClean = (event: DefaultEvent) => {
    const { disabled } = this.props;
    if (disabled) {
      return;
    }
    const nextState = {
      value: null,
      focusItemValue: null,
      searchKeyword: ''
    };

    this.setState(nextState, () => {
      this.handleChange(null, event);
      this.updatePosition();
    });
  };

  handleEntered = () => {
    const { onOpen } = this.props;
    onOpen && onOpen();
  };

  handleExited = () => {
    const { onClose, multi } = this.props;
    const value = this.getValue();

    const nextState: Object = {
      focusItemValue: multi ? _.get(value, 0) : value
    };

    if (multi) {
      /**
       在多选的情况下, 当 searchKeyword 过长，在 focus 的时候会导致内容换行。
       把 searchKeyword 清空是为了，Menu 在展开时候位置正确。
       */
      nextState.searchKeyword = '';
    }

    onClose && onClose();
    this.setState(nextState);
  };

  handleEnter = () => {
    this.focusInput();
    this.setState({ open: true });
  };

  handleExit = () => {
    this.blurInput();
    this.setState({ open: false });
  };

  handleRemoveItemByTag = (tag: string, event: DefaultEvent) => {
    event.stopPropagation();
    const value = this.getValue();
    _.remove(value, itemVal => shallowEqual(itemVal, tag));
    this.setState({ value }, this.updatePosition);
    this.handleChange(value, event);
  };

  removeLastItem = (event: SyntheticInputEvent<*>) => {
    const tagName = _.get(event, 'target.tagName');
    if (tagName !== 'INPUT') {
      this.focusInput();
      return;
    }
    if (tagName === 'INPUT' && event.target.value) {
      return;
    }
    const value: any = this.getValue();
    value.pop();
    this.setState({ value }, this.updatePosition);
    this.handleChange(value, event);
  };

  addPrefix = (name: string) => prefix(this.props.classPrefix)(name);

  renderMenuItem = (label, item) => {
    const { locale, renderMenuItem } = this.props;
    const newLabel = item.create ? <span>{tplTransform(locale.createOption, label)}</span> : label;
    return renderMenuItem ? renderMenuItem(newLabel, item) : newLabel;
  };

  renderDropdownMenu() {
    const {
      labelKey,
      groupBy,
      placement,
      locale,
      renderMenu,
      renderExtraFooter,
      menuClassName,
      menuStyle,
      menuAutoWidth,
      creatable,
      valueKey,
      multi
    } = this.props;

    const { focusItemValue, searchKeyword } = this.state;
    const menuClassPrefix = this.addPrefix(multi ? 'check-menu' : 'select-menu');
    const classes = classNames(
      menuClassPrefix,
      menuClassName,
      this.addPrefix(`placement-${_.kebabCase(placement)}`)
    );

    const allData = this.getAllData();

    let filteredData = filterNodesOfTree(allData, item => this.shouldDisplay(item[labelKey]));

    if (
      creatable &&
      searchKeyword &&
      !findNodeOfTree(allData, item => item[valueKey] === searchKeyword)
    ) {
      filteredData = [...filteredData, this.createOption(searchKeyword)];
    }

    // Create a tree structure data when set `groupBy`
    if (groupBy) {
      filteredData = getDataGroupBy(filteredData, groupBy);
    }

    const menuProps = _.pick(
      this.props,
      DropdownMenu.handledProps.filter(
        name => !['className', 'style', 'classPrefix'].some(item => item === name)
      )
    );

    const value = this.getValue();
    const menu = filteredData.length ? (
      <DropdownMenu
        {...menuProps}
        classPrefix={menuClassPrefix}
        dropdownMenuItemClassPrefix={`${menuClassPrefix}-item`}
        dropdownMenuItemComponentClass={multi ? DropdownMenuCheckItem : DropdownMenuItem}
        ref={this.bindMenuContainerRef}
        activeItemValues={multi ? value : [value]}
        focusItemValue={focusItemValue}
        data={filteredData}
        group={!_.isUndefined(groupBy)}
        onSelect={multi ? this.handleCheckItemSelect : this.handleItemSelect}
        renderMenuItem={this.renderMenuItem}
      />
    ) : (
      <div className={this.addPrefix('none')}>{locale.noResultsText}</div>
    );

    return (
      <MenuWrapper
        autoWidth={menuAutoWidth}
        className={classes}
        style={menuStyle}
        getToggleInstance={this.getToggleInstance}
        onKeyDown={this.handleKeyDown}
      >
        {renderMenu ? renderMenu(menu) : menu}
        {renderExtraFooter && renderExtraFooter()}
      </MenuWrapper>
    );
  }

  renderSingleValue() {
    const value = this.getValue();
    return this.getLabelByValue(value);
  }

  renderMultiValue() {
    const { multi, disabled } = this.props;
    if (!multi) {
      return null;
    }

    const tags = this.getValue() || [];
    return tags
      .map(tag => {
        const { isValid, displayElement } = this.getLabelByValue(tag);
        if (!isValid) {
          return null;
        }
        return (
          <Tag
            key={tag}
            closable={!disabled}
            title={typeof displayElement === 'string' ? displayElement : undefined}
            onClose={this.handleRemoveItemByTag.bind(this, tag)}
          >
            {displayElement}
          </Tag>
        );
      })
      .filter(item => item !== null);
  }

  renderInputSearch() {
    const { multi } = this.props;
    const props: Object = {
      componentClass: 'input'
    };

    if (multi) {
      props.componentClass = InputAutosize;
      // 52 = 55 (right padding)  - 2 (border) - 6 (left padding)
      props.inputStyle = { maxWidth: this.state.maxWidth - 63 };
    }

    return (
      <InputSearch
        {...props}
        inputRef={this.bindInputRef}
        onChange={this.handleSearch}
        value={this.state.open ? this.state.searchKeyword : ''}
      />
    );
  }

  render() {
    const {
      disabled,
      cleanable,
      locale,
      toggleComponentClass,
      style,
      onEnter,
      onEntered,
      onExit,
      onExited,
      searchable,
      multi,
      ...rest
    } = this.props;

    const unhandled = getUnhandledProps(Dropdown, rest);
    const { isValid, displayElement } = this.renderSingleValue();
    const tagElements = this.renderMultiValue();
    const hasValue = multi ? !!_.get(tagElements, 'length') : isValid;

    const classes = getToggleWrapperClassName('input', this.addPrefix, this.props, hasValue, {
      [this.addPrefix('tag')]: multi,
      [this.addPrefix('focused')]: this.state.open
    });

    const searching = !!this.state.searchKeyword && this.state.open;
    const displaySearchInput = searchable && !disabled;

    return (
      <PickerToggleTrigger
        pickerProps={this.props}
        innerRef={this.bindTriggerRef}
        positionRef={this.bindPositionRef}
        trigger="active"
        onEnter={createChainedFunction(this.handleEnter, onEnter)}
        onEntered={createChainedFunction(this.handleEntered, onEntered)}
        onExit={createChainedFunction(this.handleExit, onExit)}
        onExited={createChainedFunction(this.handleExited, onExited)}
        speaker={this.renderDropdownMenu()}
      >
        <div
          className={classes}
          style={style}
          onKeyDown={this.handleKeyDown}
          onClick={this.handleClick}
          ref={this.bindToggleWrapperRef}
        >
          <PickerToggle
            {...unhandled}
            ref={this.bindToggleRef}
            componentClass={toggleComponentClass}
            onClean={this.handleClean}
            cleanable={cleanable && !disabled}
            hasValue={hasValue}
          >
            {searching || (multi && hasValue) ? null : displayElement || locale.placeholder}
          </PickerToggle>
          <div className={this.addPrefix('tag-wrapper')}>
            {tagElements}
            {displaySearchInput && this.renderInputSearch()}
          </div>
        </div>
      </PickerToggleTrigger>
    );
  }
}

const enhance = defaultProps({
  classPrefix: 'picker'
});

export default enhance(Dropdown);
