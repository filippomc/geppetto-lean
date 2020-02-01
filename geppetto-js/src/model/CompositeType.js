

/**
 * Client class use to represent a composite type.
 *
 * @module model/CompositeType
 * @author Giovanni Idili
 */

import Type from './Type';
import Resources from "../Resources";

export default class CompositeType extends Type {

  constructor (node, parent) {
    super(node, parent);
    this.variables = (node.variables !== undefined) ? node.variables : [];
  }


  /**
   * Get variables
   *
   * @command CompositeType.getChildren()
   *
   * @returns {List<Variable>} - List of variables
   *
   */
  getVariables () {
    return this.variables;
  }

  /**
   * Check if the composite contains a given variable
   *
   * @param varId
   * @returns {boolean}
   */
  hasVariable (varId) {
    var vars = this.getVariables();

    var match = false;
    for (var i = 0; i < vars.length; i++) {
      if (vars[i].getId() === varId) {
        match = true;
      }
    }

    return match;
  }

  /**
   * Get combined children
   *
   * @command CompositeType.getChildren()
   *
   * @returns {List<Object>} - List of children
   *
   */
  getChildren () {
    return this.variables;
  }

  /**
   * Return connections
   *
   * @command CompositeType.getConnections()
   *
   * @returns {Boolean}
   *
   */
  getConnections () {
    var connectionVariables = [];

    for (var v in this.getVariables()) {
      var variable = this.getVariables()[v];
      if (variable.getType().getMetaType() === Resources.CONNECTION_TYPE) {
        connectionVariables.push(variable);
      }
    }

    return connectionVariables;
  }
}