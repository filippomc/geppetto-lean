

/**
 * Client class use to represent a library that contains a set of types.
 *
 * @module model/Datasource
 * @author Giovanni Idili
 */

import ObjectWrapper from './ObjectWrapper';

export default class Datasource extends ObjectWrapper {


  constructor (options) {
    super(options);
    this.queries = (options.queries !== undefined) ? options.queries : [];
  }


  /**
   * Get url for this datasource
   *
   * @command Datasource.getUrl()
   *
   * @returns {String} - datasource url as string
   *
   */
  getUrl () {
    return this.getWrappedObj().url;
  }

  /**
   * Get datasource service for this datasource
   *
   * @command Datasource.getDatasourceService()
   *
   * @returns {String} - datasource service id as string
   *
   */
  getDatasourceService () {
    return this.getWrappedObj().dataSourceService;
  }

  /**
   * Get library configurations for this datasource
   *
   * @command Datasource.getLibraryConfigurations()
   *
   * @returns {List<Object>} - datasource service id as string
   *
   */
  getLibraryConfigurations () {
    return this.getWrappedObj().libraryConfigurations;
  }

  /**
   * Get queries for this datasource
   *
   * @command Datasource.getQueries()
   *
   * @returns {List<Object>} - datasource service id as string
   *
   */
  getQueries () {
    return this.queries;
  }

  /**
   * Get dependencies library
   *
   * @command Datasource.getDependenciesLibrary()
   *
   * @returns {Object} - dependency library object
   *
   */
  getDependenciesLibrary () {
    return this.getWrappedObj().dependenciesLibrary;
  }

  /**
   * Get target library
   *
   * @command Datasource.getTargetLibrary()
   *
   * @returns {Object} - target library object
   *
   */
  getTargetLibrary () {
    return this.getWrappedObj().targetLibrary;
  }

  /**
   * Get fetch variable query
   *
   * @command Datasource.getFetchVariableQuery()
   *
   * @returns {Object} - fetch variable query
   *
   */
  getFetchVariableQuery () {
    return this.getWrappedObj().fetchVariableQuery;
  }

  /**
   * Get combined children
   *
   * @command Datasource.getChildren()
   *
   * @returns {List<Object>} - List of children
   *
   */
  getChildren () {
    /*
     * TODO: return contained children once they are model objects (lib config / queries)
     * return this.getWrappedObj().libraryConfigurations.concat(this.getWrappedObj().queries.concat([this.getWrappedObj().fetchVariableQuery]));
     */
    return [];
  }

  /**
   * Fetch variable and add to Geppetto model given variable id
   *
   * @param variableId
   */
  fetchVariable (variableIds, callback) {
    if (typeof (variableIds) == "string") {
      variableIds = [variableIds];
    }
    GEPPETTO.Manager.fetchVariables(variableIds, this.getId(), callback);
  }

}
