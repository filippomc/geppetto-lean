/**
 * Client class use to represent top level Geppetto model.
 *
 * @module model/GeppettoModel
 * @author Giovanni Idili
 */

import ObjectWrapper from './ObjectWrapper';
import Resources from '../Resources';
import Instance from "./Instance";
import ModelFactory from "../ModelFactory";

export default class GeppettoModel extends ObjectWrapper {

  constructor (options) {
    options.parent = null;
    super(options);

    this.variables = (options.variables !== undefined) ? options.variables : [];
    this.libraries = (options.libraries !== undefined) ? options.libraries : [];
    this.datasources = (options.datasources !== undefined) ? options.datasources : [];
    this.queries = (options.queries !== undefined) ? options.queries : [];
    this.worlds = this.getWrappedObj().worlds.map(world => ModelFactory.createWorld(world, this));
    this.currentWorldIdx = this.wrappedObj.worlds && this.wrappedObj.worlds.length ? 0 : -1;
    this.allPaths = [];
    this.allPathsIndexing = [];
  }

  static fillWorldsFromRawModel (geppettoModel, jsonModel) {

  }

  /**
   * Get variables
   *
   * @command GeppettoModel.getVariables()
   *
   * @returns {List<Variable>} - List of Variable objects
   *
   */
  getVariables (legacy) {
    if (this.currentWorldIdx >= 0 && !legacy) {
      return this.getCurrentWorld().getVariables();
    }
    return this.variables;
  }

  addToVariables (variablesToAdd) {
    let variables = this.getVariables();
    variables.push.apply(variables, variablesToAdd);
  }

  setVariables (variables) {
    if (this.currentWorldIdx >= 0) {
      this.getCurrentWorld().setVariables(variables);
    } else {
      this.variables = variables;
    }
  }

  getAllVariables () {
    if (this.currentWorldIdx >= 0) {
      return this.getCurrentWorld().getVariables().concat(this.variables);
    }
    return this.variables;
  }


  /**
   * Get the id
   *
   * @command GeppettoModel.getId()
   *
   * @returns {String} - The id of the model, a constant
   *
   */
  getId () {
    return Resources.MODEL_PREFIX_CLIENT;
  }

  /**
   * Get libraries
   *
   * @command GeppettoModel.getLibraries()
   *
   * @returns {List<Library>} - List of library objects
   *
   */
  getLibraries () {
    return this.libraries;
  }

  /**
   * Get datasources
   *
   * @command GeppettoModel.getDatasources()
   *
   * @returns {List<Datasource>} - List of datasource objects
   *
   */
  getDatasources () {
    return this.datasources;
  }

  /**
   * Get top level queries
   *
   * @command GeppettoModel.getQueries()
   *
   * @returns {List<Query>} - List of query objects
   *
   */
  getQueries () {
    return this.queries;
  }

  /**
   * Get combined list of all children
   *
   * @command GeppettoModel.getChildren()
   *
   * @returns {List<Object>} - List of children
   *
   */
  getChildren () {
    return this.variables.concat(this.libraries, this.datasources, this.queries, this.worlds);
  }


  /**
   * Get the default selected world
   *
   */
  getCurrentWorld () {
    return this.worlds[this.currentWorldIdx];
  }

  /**
   * Get worlds
   *
   */
  getWorlds () {
    return this.worlds;
  }

  /**
   * Set the default selected world
   *
   */
  activateWorld (worldOrIndex) {
    if (typeof worldOrIndex === 'number') {
      this.currentWorldIdx = worldOrIndex;
    } else if (typeof worldOrIndex === 'string') {
      this.currentWorldIdx = this.worlds.findIndex(world => world.id === worldOrIndex);
    }
    this.currentWorldIdx = this.worlds.findIndex(world => world.id === worldOrIndex.id);
    if (this.worlds[this.currentWorldIdx] === undefined) {
      console.error(worldOrIndex, "world not found in model");
      throw "World not found in model";
    }
  }


  /**
   * A generic method to resolve a reference
   */
  resolve (refStr) {

    let reference = undefined;
    /*
     * Examples of reference strings
     * //@libraries.0/@types.20/@variables.5/@anonymousTypes.0/@variables.7
     * //@libraries.1/@types.5
     * //@tags.1/@tags.5
     * //@libraries.0/@types.8/@visualGroups.0/@visualGroupElements.1
     */
    let raw = refStr.replace("geppettoModel#", "");

    raw = raw.replace(/\//g, '').split('@');
    for (var i = 0; i < raw.length; i++) {
      var index = parseInt(raw[i].split('.')[1]);
      if (raw[i].indexOf('libraries') > -1) {
        reference = this.getLibraries()[index];
      } else if (raw[i].indexOf('variables') > -1) {
        if (reference === undefined) {
          reference = this.getVariables()[index];
        } else {
          reference = reference.getVariables()[index];
        }
      } else if (raw[i].indexOf('types') > -1) {
        reference = reference.getTypes()[index];
      } else if (raw[i].indexOf('anonymousTypes') > -1) {
        reference = reference.getAnonymousTypes()[index];
      } else if (raw[i].indexOf('tags') > -1 && i === 1) {
        reference = this.wrappedObj.tags && this.wrappedObj.tags.length >= index ? this.wrappedObj.tags[index] : this.tags[index];
      } else if (reference && raw[i].indexOf('tags') > -1 && i === 2) {
        reference = reference.tags[index];
      } else if (reference && raw[i].indexOf('visualGroups') > -1) {
        reference = reference.getVisualGroups()[index];
      } else if (reference && raw[i].indexOf('visualGroupElements') > -1) {
        reference = reference.getVisualGroupElements()[index];
      } else if (reference && raw[i].indexOf('worlds') > -1) {
        reference = this.getWorlds()[index];
      } else if (reference && raw[i].indexOf('instances') > -1) {
        reference = reference.getInstances()[index];
      }
    }
    return reference;
  }

  /**
   * Get all types of given a meta type (string)
   *
   * @param metaType - metaType String
   *
   * @returns {Array} - Types
   */
  getAllTypesOfMetaType (metaType) {
    var types = [];

    // iterate all libraries
    var libraries = this.getLibraries();
    for (var i = 0; i < libraries.length; i++) {
      // iterate all types within library
      var libraryTypes = libraries[i].getTypes();
      for (var j = 0; j < libraryTypes.length; j++) {
        // add if its metatype matches
        if (libraryTypes[j].getMetaType() === metaType) {
          types.push(libraryTypes[j]);
        }
      }
    }

    return types;
  }


}