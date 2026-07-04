<?php

namespace App\Http\Requests\Organizations;

use App\DTOs\Organizations\RespondToOrganizationInvitationData;
use App\Models\OrganizationInvitation;
use App\Models\User;
use App\Rules\ValidOrganizationInvitation;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class RespondToOrganizationInvitationRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'invitation' => ['required', new ValidOrganizationInvitation($this->user())],
        ];
    }

    /**
     * Get the validation data from the request.
     *
     * @return array<string, mixed>
     */
    public function validationData(): array
    {
        return array_merge(parent::validationData(), [
            'invitation' => $this->route('invitation'),
        ]);
    }

    public function toDto(): RespondToOrganizationInvitationData
    {
        return new RespondToOrganizationInvitationData(
            user: $this->authenticatedUser(),
            invitation: $this->invitation(),
        );
    }

    private function invitation(): OrganizationInvitation
    {
        $invitation = $this->route('invitation');

        abort_unless($invitation instanceof OrganizationInvitation, 404);

        return $invitation;
    }

    private function authenticatedUser(): User
    {
        $user = $this->user();

        abort_unless($user instanceof User, 403);

        return $user;
    }
}
