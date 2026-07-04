<?php

namespace App\Http\Requests\Organizations;

use App\DTOs\Organizations\InviteOrganizationMemberData;
use App\Enums\OrganizationRole;
use App\Models\Organization;
use App\Models\User;
use App\Rules\UniqueOrganizationInvitation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateOrganizationInvitationRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $organization = $this->route('organization');

        abort_if(! $organization instanceof Organization, 404);

        return [
            'email' => ['required', 'string', 'email', 'max:255', new UniqueOrganizationInvitation($organization)],
            'role' => ['required', 'string', Rule::enum(OrganizationRole::class)],
        ];
    }

    public function toDto(): InviteOrganizationMemberData
    {
        return new InviteOrganizationMemberData(
            inviter: $this->authenticatedUser(),
            organization: $this->organization(),
            email: $this->validated('email'),
            role: OrganizationRole::from($this->validated('role')),
        );
    }

    private function organization(): Organization
    {
        $organization = $this->route('organization');

        abort_if(! $organization instanceof Organization, 404);

        return $organization;
    }

    private function authenticatedUser(): User
    {
        $user = $this->user();

        abort_unless($user instanceof User, 403);

        return $user;
    }
}
