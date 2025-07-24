<script lang="ts">
  import {
    FolderViewMode,
    folderViewSettings,
  } from '$lib/stores/preferences.store';
  import { Button } from '@immich/ui';
  import {
    mdiFormatListBulletedSquare,
    mdiViewGridOutline,
  } from '@mdi/js';
  import { t } from 'svelte-i18n';

  const handleChangeViewMode = () => {
    $folderViewSettings.view =
      $folderViewSettings.view === FolderViewMode.Thumbnail ? FolderViewMode.List : FolderViewMode.Thumbnail;
  };
</script>

<!-- Thumbnail/List Display Toggle -->
{#if $folderViewSettings.view === FolderViewMode.List}
  <Button
    leadingIcon={mdiViewGridOutline}
    onclick={handleChangeViewMode}
    size="small"
    variant="ghost"
    color="secondary"
  >
    <span class="hidden md:block">{$t('thumbnails')}</span>
  </Button>
{:else}
  <Button
    leadingIcon={mdiFormatListBulletedSquare}
    onclick={handleChangeViewMode}
    size="small"
    variant="ghost"
    color="secondary"
  >
    <span class="hidden md:block">{$t('list')}</span>
  </Button>
{/if}