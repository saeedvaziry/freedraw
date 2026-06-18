<?php

namespace App\Data;

readonly class OrganizationPermissions
{
    public function __construct(
        public bool $canUpdateOrganization,
        public bool $canDeleteOrganization,
        public bool $canAddMember,
        public bool $canUpdateMember,
        public bool $canRemoveMember,
        public bool $canCreateInvitation,
        public bool $canCancelInvitation,
    ) {
        //
    }
}
