<?php

namespace App\Enums;

enum PageVisibility: string
{
    case Private = 'private';
    case Organization = 'organization';
    case Public = 'public';

    /**
     * Get the display label for the visibility.
     */
    public function label(): string
    {
        return match ($this) {
            self::Private => 'Only me',
            self::Organization => 'Anyone in the organization',
            self::Public => 'Anyone with the link',
        };
    }

    /**
     * Determine if the visibility exposes the page to the whole organization.
     */
    public function isShared(): bool
    {
        return $this !== self::Private;
    }
}
