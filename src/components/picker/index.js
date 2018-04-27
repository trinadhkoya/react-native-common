/**
 * Copyright 2016 Reza (github.com/rghorbani)
 *
 * @flow
 */

'use strict';

const React = require('react');
const PropTypes = require('prop-types');
const _ = require('lodash');
const { Text } = require('react-native');
const NativePicker = require('./NativePicker');
const PickerModal = require('./PickerModal');
const PickerItem = require('./PickerItem');
const PickerPresenter = require('./PickerPresenter');
const Button = require('../../components/button');
const View = require('../../components/view');
const { TextInput } = require('../inputs');
const { Modal } = require('../../screen-components');
const { Constants } = require('../../helpers');
const { Colors } = require('../../style');

const PICKER_MODES = {
  SINGLE: 'SINGLE',
  MULTI: 'MULTI',
};

const ItemType = PropTypes.shape({value: PropTypes.any, label: PropTypes.string});

// TODO: depreacte value allowing passing an object, allow only string or number
// TODO: extract picker labels from children in order to obtain the
// correct label to render (similar to what we do in NativePicker)
// TODO: simplify this component, stop inherit from TextInput

/**
 * @description: Picker Component, support single or multiple selection, blurModel and floatingPlaceholder
 * @extends: TextInput
 * @extendslink: docs/TextInput
 * @gif: https://media.giphy.com/media/3o751SiuZZiByET2lq/giphy.gif
 */
class Picker extends TextInput {
  static displayName = 'Picker';

  static modes = PICKER_MODES;

  static propTypes = {
    ...TextInput.propTypes,
    /**
     * picker current value in the shape of {value: ..., label: ...}, for custom shape use 'getItemValue' prop
     */
    value: PropTypes.oneOfType([
      ItemType,
      PropTypes.arrayOf(ItemType),
      PropTypes.object,
      PropTypes.string,
      PropTypes.number,
    ]),
    /**
     * callback for when picker value change
     */
    onChange: PropTypes.func,
    /**
     * SINGLE mode or MULTI mode
     */
    mode: PropTypes.oneOf(Object.keys(PICKER_MODES)),
    /**
     * Adds blur effect to picker modal (only iOS)
     */
    enableModalBlur: PropTypes.bool,
    /**
     * render custom picker
     */
    renderPicker: PropTypes.func,
    /**
     * add onPress callback for when pressing the picker
     */
    onPress: PropTypes.func,
    /**
     * a function that extract the unique value out of the value prop in case value has a custom structure.
     */
    getItemValue: PropTypes.func,
    /**
     * a function that returns the label to show for the selected Picker value
     */
    getLabel: PropTypes.func,
    /**
     * The picker modal top bar props
     */
    topBarProps: PropTypes.shape(Modal.TopBar.propTypes),
    /**
     * show search input to filter picker items by label
     */
    showSearch: PropTypes.bool,
    /**
     * Allow to use the native picker solution (different for iOS and Android)
     */
    useNativePicker: PropTypes.bool,
  };

  static defaultProps = {
    ...TextInput.defaultProps,
    mode: PICKER_MODES.SINGLE,
    // enableModalBlur: true,
    expandable: true,
    text70: true,
    // floatingPlaceholder: true,
  };

  constructor(props) {
    super(props);

    this.onDoneSelecting = this.onDoneSelecting.bind(this);
    this.toggleItemSelection = this.toggleItemSelection.bind(this);
    this.appendPropsToChildren = this.appendPropsToChildren.bind(this);
    this.onSelectedItemLayout = this.onSelectedItemLayout.bind(this);
    this.onSearchChange = this.onSearchChange.bind(this);
    this.cancelSelect = this.cancelSelect.bind(this);
    this.handlePickerOnPress = this.handlePickerOnPress.bind(this);

    this.state = {
      ...this.state,
      showModal: false,
      selectedItemPosition: 0,
    };

    if (props.mode === Picker.modes.SINGLE && Array.isArray(props.value)) {
      console.warn('Picker in SINGLE mode cannot accept an array for value');
    }

    if (props.mode === Picker.modes.MULTI && !Array.isArray(props.value)) {
      console.warn('Picker in MULTI mode must accept an array for value');
    }
  }

  componentWillReceiveProps(nexProps) {
    this.setState({
      value: nexProps.value,
    });
  }

  toggleItemSelection(item) {
    const {value} = this.state;
    const newValue = _.xorBy(value, [item], 'value');
    this.setState({
      value: newValue,
    });
  }

  onDoneSelecting(item) {
    this.setState({searchValue: ''}); // clean search when done selecting
    this.onChangeText(item);
    this.toggleExpandableModal(false);
    this.props.onChange && this.props.onChange(item);
  }

  onSearchChange(searchValue) {
    this.setState({
      searchValue,
    });
  }

  cancelSelect() {
    this.setState({
      value: this.props.value,
    });
    this.toggleExpandableModal(false);
  }

  onSelectedItemLayout({nativeEvent: {layout: {y}}}) {
    this.setState({selectedItemPosition: y});
  }

  appendPropsToChildren() {
    const {children, mode, getItemValue, showSearch} = this.props;
    const {value, searchValue} = this.state;
    const childrenWithProps = React.Children.map(children, (child) => {
      const childValue = PickerPresenter.getItemValue({getItemValue, ...child.props});
      const childLabel = PickerPresenter.getItemLabel({...child.props, getLabel: child.props.getItemLabel});
      if (!showSearch || _.isEmpty(searchValue) || _.includes(_.lowerCase(childLabel), _.lowerCase(searchValue))) {
        const selectedValue = PickerPresenter.getItemValue({value, getItemValue});
        return React.cloneElement(child, {
          isSelected: PickerPresenter.isItemSelected(childValue, selectedValue),
          onPress: mode === Picker.modes.MULTI ? this.toggleItemSelection : this.onDoneSelecting,
          getItemValue: child.props.getItemValue || getItemValue,
          onSelectedLayout: this.onSelectedItemLayout,
        });
      }
    });

    return childrenWithProps;
  }

  getLabel() {
    const {getLabel} = this.props;
    const {value} = this.state;
    if (_.isArray(value)) {
      return _.chain(value)
        .map('label')
        .join(', ')
        .value();
    }
    return _.isFunction(getLabel) ? getLabel(value) : _.get(value, 'label');
  }

  handlePickerOnPress() {
    this.toggleExpandableModal(true);
    this.props.onPress && this.props.onPress();
  }

  renderExpandableInput() {
    const {value} = this.state;
    const {placeholder, style} = this.props;
    const typography = this.getTypography();
    const color = this.extractColorValue() || Colors.dark10;
    const label = this.getLabel();
    const shouldShowPlaceholder = _.isEmpty(value);

    return (
      <Text
        style={[
          this.styles.input,
          typography,
          {color},
          style,
          {height: Constants.isAndroid ? typography.lineHeight : undefined},
          shouldShowPlaceholder && this.styles.placeholder,
        ]}
        numberOfLines={3}
        onPress={this.handlePickerOnPress}
      >
        {shouldShowPlaceholder ? placeholder : label}
      </Text>
    );
  }

  renderExpandableModal() {
    const {mode, enableModalBlur, topBarProps, showSearch} = this.props;
    const {showExpandableModal, selectedItemPosition} = this.state;
    return (
      <PickerModal
        visible={showExpandableModal}
        scrollPosition={selectedItemPosition}
        enableModalBlur={enableModalBlur}
        topBarProps={{
          ...topBarProps,
          onCancel: this.cancelSelect,
          onDone: mode === Picker.modes.MULTI ? () => this.onDoneSelecting(this.state.value) : undefined,
        }}
        showSearch={showSearch}
        onSearchChange={this.onSearchChange}
      >
        {this.appendPropsToChildren(this.props.children)}
      </PickerModal>
    );
  }

  render() {
    const {useNativePicker, renderPicker, testID} = this.props;

    if (useNativePicker) return <NativePicker {...this.props} />;

    if (_.isFunction(renderPicker)) {
      const {value} = this.state;
      return (
        <View left>
          <Button link onPress={this.handlePickerOnPress} testID={testID}>
            {renderPicker(value)}
          </Button>
          {this.renderExpandableModal()}
        </View>
      );
    }

    return super.render();
  }
}

Picker.Item = PickerItem;
module.exports = Picker;
