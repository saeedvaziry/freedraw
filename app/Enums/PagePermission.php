<?php

namespace App\Enums;

enum PagePermission: string
{
    case View = 'view';
    case Edit = 'edit';

    /**
     * Get the display label for the permission.
     */
    public function label(): string
    {
        return match ($this) {
            self::View => 'Can view',
            self::Edit => 'Can edit',
        };
    }

    /**
     * Determine if the permission grants edit access.
     */
    public function canEdit(): bool
    {
        return $this === self::Edit;
    }
}
