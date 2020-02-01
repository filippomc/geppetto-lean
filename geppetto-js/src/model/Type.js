/**
 * Client class use to represent a simple type.
 *
 * @module model/Type
 * @author Giovanni Idili
 * @author Matteo Cantarelli
 */
import { extend } from '../Utility';
import ObjectWrapper from './ObjectWrapper';
import Variable from './Variable';

export default class Type extends ObjectWrapper {
  constructor (node, library) {
    super({
      wrappedObj: node,
      parent: library
    });
    this.superType = node.superType;
    this.visualType = node.visualType;
    this.capabilities = [];
    this.variableReferences = [];
  }


  /**
   * Gets the default value for this type
   *
   * @command Type.getDefaultValue()
   *
   * @returns {Object} - Default value
   *
   */
  getDefaultValue () {
    return this.wrappedObj.defaultValue;
  }

  /**
   * Gets the super type for this type
   *
   * @command Type.getSuperType()
   *
   * @returns {List<Type>} - Super type
   *
   */
  getSuperType () {
    var superType = this.superType;

    if (superType !== undefined && this.superType.length === 1) {
      superType = superType[0];
    }

    return superType;
  }

  /**
   * Check if the type is abstract
   *
   * @command Type.isAbstract()
   *
   * @returns {Boolean} - Boolean indicating if the type is abstract
   *
   */
  isAbstract () {
    return this.wrappedObj.abstract;
  }

  /**
   * Gets the visual type for this type if any
   *
   * @command Type.getVisualType()
   *
   * @returns {Type} - Super type
   *
   */
  getVisualType () {
    return this.visualType;
  }


  /**
   * Extends with methods from another object
   *
   * @command Type.extendApi(extensionObj)
   */
  extendApi (extensionObj) {
    extend(this, extensionObj);
    this.capabilities.push(extensionObj.capabilityId);
  }

  /**
   * Checks if the instance has a given capability
   *
   * @command Type.hasCapability(capabilityId)
   *
   * @returns {Boolean}
   */
  hasCapability (capabilityId) {
    var hasCapability = false;
    var capabilities = this.capabilities;

    for (var i = 0; i < capabilities.length; i++) {
      if (capabilities[i] === capabilityId) {
        hasCapability = true;
      }
    }

    return hasCapability;
  }

  /**
   *
   * @param v
   */
  addVariableReference (v) {
    this.variableReferences.push(v);
  }

  /**
   *
   * @returns {Array}
   */
  getVariableReferences () {
    return this.variableReferences;
  }

  getPath () {
    if (this.parent !== undefined & this.parent instanceof Variable) {
      // if this is an anonymous type it doesn't have an id, hence we skip it
      return this.parent.getPath();
    } else {
      return ObjectWrapper.prototype.getPath.call(this);
    }
  }

  typeOf (type) {
    var match = false;

    if (type.getPath() === this.getPath()) {
      // check if it's the same type
      match = true;
    } else {
      // recurse on parents and figure out if there is a type in the inheritance chain
      var superTypes = type.superType;

      for (var i = 0; i < superTypes.length; i++) {
        match = this.typeOf(superTypes[i]);
        if (match) {
          break;
        }
      }
    }

    return match;
  }


  populateTypeReferences () {
    super.populateTypeReferences();
    const node = this;
    // check if variable, if so populate type references

    // take visual type string - looks like this --> '//@libraries.1/@types.5'
    var vizType = node.getVisualType();

    if (vizType !== undefined) {
      // replace with reference to actual type
      var typeObj = node.geppettoModel.resolve(vizType.$ref);
      node.visualType = typeObj;
    }

    // resolve super type
    var superType = node.getSuperType();
    if (superType !== undefined) {
      var typeObjs = [];

      // convert to array if single element
      if (!(superType instanceof Array)) {
        superType = [superType];
      }

      for (var a = 0; a < superType.length; a++) {
        if (superType[a].$ref) {
          // replace with reference to actual type
          typeObjs.push(node.geppettoModel.resolve(superType[a].$ref));
        } else {
          // replace with reference to actual type
          typeObjs.push(superType[a]);
        }
      }

      node.superType = typeObjs;
    }
  }
}
