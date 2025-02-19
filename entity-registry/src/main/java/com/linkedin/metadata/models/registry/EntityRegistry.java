package com.linkedin.metadata.models.registry;

import com.linkedin.events.metadata.ChangeType;
import com.linkedin.metadata.aspect.plugins.PluginFactory;
import com.linkedin.metadata.aspect.plugins.hooks.MCLSideEffect;
import com.linkedin.metadata.aspect.plugins.hooks.MCPSideEffect;
import com.linkedin.metadata.aspect.plugins.hooks.MutationHook;
import com.linkedin.metadata.aspect.plugins.validation.AspectPayloadValidator;
import com.linkedin.metadata.models.AspectSpec;
import com.linkedin.metadata.models.DefaultEntitySpec;
import com.linkedin.metadata.models.EntitySpec;
import com.linkedin.metadata.models.EventSpec;
import com.linkedin.metadata.models.registry.template.AspectTemplateEngine;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;

/**
 * The Entity Registry provides a mechanism to retrieve metadata about entities modeled in GMA.
 * Metadata includes the entity's common name, the aspects that comprise it, and search index +
 * relationship index information about the entity.
 */
public interface EntityRegistry {

  default String getIdentifier() {
    return "Unknown";
  }

  /**
   * Given an entity name, returns an instance of {@link DefaultEntitySpec}
   *
   * @param entityName the name of the entity to be retrieved
   * @return an {@link DefaultEntitySpec} corresponding to the entity name provided, null if none
   *     exists.
   */
  @Nonnull
  EntitySpec getEntitySpec(@Nonnull final String entityName);

  /**
   * Given an event name, returns an instance of {@link DefaultEventSpec}.
   *
   * @param eventName the name of the event to be retrieved
   * @return an {@link DefaultEventSpec} corresponding to the entity name provided, null if none
   *     exists.
   */
  @Nullable
  EventSpec getEventSpec(@Nonnull final String eventName);

  /**
   * Returns all {@link DefaultEntitySpec}s that the registry is aware of.
   *
   * @return a map of String to {@link DefaultEntitySpec}s, empty map if none exists.
   */
  @Nonnull
  Map<String, EntitySpec> getEntitySpecs();

  /**
   * Returns all {@link AspectSpec}s that the registry is aware of.
   *
   * @return a map of String to {@link AspectSpec}s, empty map if none exists.
   */
  @Nonnull
  Map<String, AspectSpec> getAspectSpecs();

  /** Returns all {@link EventSpec}s that the registry is aware of. */
  @Nonnull
  Map<String, EventSpec> getEventSpecs();

  /**
   * Returns an {@link AspectTemplateEngine} that is used for generating templates from {@link
   * com.linkedin.metadata.models.AspectSpec}s
   *
   * @return a template engine instance associated with this registry
   */
  @Nonnull
  AspectTemplateEngine getAspectTemplateEngine();

  /**
   * Returns applicable {@link AspectPayloadValidator} implementations given the change type and
   * entity/aspect information.
   *
   * @param changeType The type of change to be validated
   * @param entityName The entity name
   * @param aspectName The aspect name
   * @return List of validator implementations
   */
  @Nonnull
  default List<AspectPayloadValidator> getAspectPayloadValidators(
      @Nonnull ChangeType changeType, @Nonnull String entityName, @Nonnull String aspectName) {
    return getAllAspectPayloadValidators().stream()
        .filter(
            aspectPayloadValidator ->
                aspectPayloadValidator.shouldApply(changeType, entityName, aspectName))
        .collect(Collectors.toList());
  }

  @Nonnull
  default List<AspectPayloadValidator> getAllAspectPayloadValidators() {
    return getPluginFactory().getAspectPayloadValidators();
  }

  /**
   * Return mutation hooks for {@link com.linkedin.data.template.RecordTemplate}
   *
   * @param changeType The type of change
   * @param entityName The entity name
   * @param aspectName The aspect name
   * @return Mutation hooks
   */
  @Nonnull
  default List<MutationHook> getMutationHooks(
      @Nonnull ChangeType changeType, @Nonnull String entityName, @Nonnull String aspectName) {
    return getAllMutationHooks().stream()
        .filter(mutationHook -> mutationHook.shouldApply(changeType, entityName, aspectName))
        .collect(Collectors.toList());
  }

  @Nonnull
  default List<MutationHook> getAllMutationHooks() {
    return getPluginFactory().getMutationHooks();
  }

  /**
   * Returns the side effects to apply to {@link com.linkedin.mxe.MetadataChangeProposal}. Side
   * effects can generate one or more additional MCPs during write operations.
   *
   * @param changeType The type of change
   * @param entityName The entity name
   * @param aspectName The aspect name
   * @return MCP side effects
   */
  @Nonnull
  default List<MCPSideEffect> getMCPSideEffects(
      @Nonnull ChangeType changeType, @Nonnull String entityName, @Nonnull String aspectName) {
    return getAllMCPSideEffects().stream()
        .filter(mcpSideEffect -> mcpSideEffect.shouldApply(changeType, entityName, aspectName))
        .collect(Collectors.toList());
  }

  @Nonnull
  default List<MCPSideEffect> getAllMCPSideEffects() {
    return getPluginFactory().getMcpSideEffects();
  }

  /**
   * Returns the side effects to apply to {@link com.linkedin.mxe.MetadataChangeLog}. Side effects
   * can generate one or more additional MCLs during write operations.
   *
   * @param changeType The type of change
   * @param entityName The entity name
   * @param aspectName The aspect name
   * @return MCL side effects
   */
  @Nonnull
  default List<MCLSideEffect> getMCLSideEffects(
      @Nonnull ChangeType changeType, @Nonnull String entityName, @Nonnull String aspectName) {
    return getAllMCLSideEffects().stream()
        .filter(mclSideEffect -> mclSideEffect.shouldApply(changeType, entityName, aspectName))
        .collect(Collectors.toList());
  }

  @Nonnull
  default List<MCLSideEffect> getAllMCLSideEffects() {
    return getPluginFactory().getMclSideEffects();
  }

  /**
   * Returns underlying plugin factory
   *
   * @return the plugin factory
   */
  @Nonnull
  default PluginFactory getPluginFactory() {
    return PluginFactory.empty();
  }
}
