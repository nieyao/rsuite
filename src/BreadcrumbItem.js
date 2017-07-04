import classNames from 'classnames';
import PropTypes from 'prop-types';
import React from 'react';
import elementType from 'rsuite-utils/lib/propTypes/elementType';
import SafeAnchor from './SafeAnchor';

const propTypes = {
  active: PropTypes.bool,
  componentClass: elementType,
  className: PropTypes.string,
  style: PropTypes.object,
  href: PropTypes.string,
  title: PropTypes.node,
  target: PropTypes.string,
};

const defaultProps = {
  componentClass: null,
  href: null,
  title: null,
  target: null,
  className: null,
  style: null,
  active: false
};

class BreadcrumbItem extends React.Component {
  render() {

    const { componentClass, href, title, target, className, style, active, ...props } = this.props;
    const Component = componentClass || SafeAnchor;
    const linkProps = { href, title, target };

    return (
      <li
        style={style}
        className={classNames(className, { active })}
      >
        {active ? (<span {...props} />) : (
          <Component
            {...props}
            {...linkProps}
          />
        )}
      </li>
    );
  }
}

BreadcrumbItem.propTypes = propTypes;
BreadcrumbItem.defaultProps = defaultProps;

export default BreadcrumbItem;
