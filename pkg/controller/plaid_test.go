package controller_test

import (
	"context"
	"net/http"
	"testing"

	"github.com/brianvoe/gofakeit/v6"
	"github.com/jarcoal/httpmock"
	"github.com/monetr/monetr/pkg/internal/fixtures"
	"github.com/monetr/monetr/pkg/internal/mock_plaid"
	"github.com/monetr/monetr/pkg/internal/testutils"
	"github.com/monetr/monetr/pkg/secrets"
	"github.com/plaid/plaid-go/plaid"
	"github.com/stretchr/testify/assert"
)

func TestPostTokenCallback(t *testing.T) {
	t.Run("cant retrieve accounts", func(t *testing.T) {
		httpmock.Activate()
		defer httpmock.DeactivateAndReset()

		e := NewTestApplication(t)
		token := GivenIHaveToken(t, e)

		publicToken := mock_plaid.MockExchangePublicToken(t)
		mock_plaid.MockGetAccounts(t, nil)

		response := e.POST("/api/plaid/link/token/callback").
			WithCookie(TestCookieName, token).
			WithJSON(map[string]interface{}{
				"publicToken":     publicToken,
				"institutionId":   "123",
				"institutionName": gofakeit.Company(),
				"accountIds": []string{
					gofakeit.UUID(),
				},
			}).
			Expect()

		response.Status(http.StatusInternalServerError)
		response.JSON().Path("$.error").String().Equal("could not retrieve details for any accounts")
	})
}

func TestPutUpdatePlaidLink(t *testing.T) {
	t.Run("successful with account select enabled", func(t *testing.T) {
		httpmock.Activate()
		defer httpmock.DeactivateAndReset()

		e := NewTestApplication(t)
		user, password := fixtures.GivenIHaveABasicAccount(t)
		link := fixtures.GivenIHaveAPlaidLink(t, user)

		// We need to store a Plaid access token for this test.
		secret := secrets.NewPostgresPlaidSecretsProvider(testutils.GetLog(t), testutils.GetPgDatabase(t), nil)
		assert.NoError(t, secret.UpdateAccessTokenForPlaidLinkId(
			context.Background(),
			link.AccountId,
			link.PlaidLink.ItemId,
			gofakeit.UUID(),
		), "must be able to store a secret for the fake plaid link")

		token := GivenILogin(t, e, user.Login.Email, password)

		mock_plaid.MockCreateLinkToken(t, func(t *testing.T, request plaid.LinkTokenCreateRequest) {
			assert.NotNil(t, request.GetUpdate().AccountSelectionEnabled, "account selection enabled cannot be nil")
			assert.True(t, *request.GetUpdate().AccountSelectionEnabled, "account selection enabled must be true")
		})

		response := e.PUT("/api/plaid/link/update/{linkId}").
			WithPath("linkId", link.LinkId).
			WithQuery("update_account_selection", "true").
			WithCookie(TestCookieName, token).
			Expect()

		response.Status(http.StatusOK)
		response.JSON().Path("$.linkToken").String().NotEmpty()
		assert.EqualValues(t, httpmock.GetCallCountInfo(), map[string]int{
			"POST https://sandbox.plaid.com/link/token/create": 1,
		}, "must match expected Plaid API calls")
	})

	t.Run("successful with account select disabled", func(t *testing.T) {
		httpmock.Activate()
		defer httpmock.DeactivateAndReset()

		e := NewTestApplication(t)
		user, password := fixtures.GivenIHaveABasicAccount(t)
		link := fixtures.GivenIHaveAPlaidLink(t, user)

		// We need to store a Plaid access token for this test.
		secret := secrets.NewPostgresPlaidSecretsProvider(testutils.GetLog(t), testutils.GetPgDatabase(t), nil)
		assert.NoError(t, secret.UpdateAccessTokenForPlaidLinkId(
			context.Background(),
			link.AccountId,
			link.PlaidLink.ItemId,
			gofakeit.UUID(),
		), "must be able to store a secret for the fake plaid link")

		token := GivenILogin(t, e, user.Login.Email, password)

		mock_plaid.MockCreateLinkToken(t, func(t *testing.T, request plaid.LinkTokenCreateRequest) {
			assert.NotNil(t, request.GetUpdate().AccountSelectionEnabled, "account selection enabled cannot be nil")
			assert.False(t, *request.GetUpdate().AccountSelectionEnabled, "account selection enabled must be false")
		})

		response := e.PUT("/api/plaid/link/update/{linkId}").
			WithPath("linkId", link.LinkId).
			WithCookie(TestCookieName, token).
			Expect()

		response.Status(http.StatusOK)
		response.JSON().Path("$.linkToken").String().NotEmpty()
		assert.EqualValues(t, httpmock.GetCallCountInfo(), map[string]int{
			"POST https://sandbox.plaid.com/link/token/create": 1,
		}, "must match expected Plaid API calls")
	})

	t.Run("manual link", func(t *testing.T) {
		e := NewTestApplication(t)
		user, password := fixtures.GivenIHaveABasicAccount(t)
		link := fixtures.GivenIHaveAManualLink(t, user)
		token := GivenILogin(t, e, user.Login.Email, password)

		response := e.PUT("/api/plaid/link/update/{linkId}").
			WithPath("linkId", link.LinkId).
			WithQuery("update_account_selection", "true").
			WithCookie(TestCookieName, token).
			Expect()

		response.Status(http.StatusBadRequest)
		response.JSON().Path("$.error").String().Equal("cannot update a non-Plaid link")
	})

	t.Run("no plaid access token", func(t *testing.T) {
		e := NewTestApplication(t)
		user, password := fixtures.GivenIHaveABasicAccount(t)
		link := fixtures.GivenIHaveAPlaidLink(t, user)
		token := GivenILogin(t, e, user.Login.Email, password)

		mock_plaid.MockCreateLinkToken(t)

		response := e.PUT("/api/plaid/link/update/{linkId}").
			WithPath("linkId", link.LinkId).
			WithQuery("update_account_selection", "true").
			WithCookie(TestCookieName, token).
			Expect()

		response.Status(http.StatusInternalServerError)
		response.JSON().Path("$.error").String().Equal("failed to create Plaid client for link")
	})

	t.Run("missing link ID", func(t *testing.T) {
		e := NewTestApplication(t)
		token := GivenIHaveToken(t, e)

		response := e.PUT("/api/plaid/link/update/-1").
			WithQuery("update_account_selection", "true").
			WithCookie(TestCookieName, token).
			Expect()

		response.Status(http.StatusNotFound)
		response.JSON().Path("$.error").String().Equal("the requested path does not exist")
	})

	t.Run("bad link ID", func(t *testing.T) {
		e := NewTestApplication(t)
		token := GivenIHaveToken(t, e)

		response := e.PUT("/api/plaid/link/update/0").
			WithQuery("update_account_selection", "true").
			WithCookie(TestCookieName, token).
			Expect()

		response.Status(http.StatusBadRequest)
		response.JSON().Path("$.error").String().Equal("must specify a link Id")
	})

	t.Run("invalid update_account_selection", func(t *testing.T) {
		e := NewTestApplication(t)
		token := GivenIHaveToken(t, e)

		response := e.PUT("/api/plaid/link/update/123").
			WithQuery("update_account_selection", "bogus").
			WithCookie(TestCookieName, token).
			Expect()

		response.Status(http.StatusBadRequest)
		response.JSON().Path("$.error").String().Equal("update_account_selection must be provided a valid boolean value")
	})

	t.Run("missing link", func(t *testing.T) {
		e := NewTestApplication(t)
		token := GivenIHaveToken(t, e)

		response := e.PUT("/api/plaid/link/update/123").
			WithCookie(TestCookieName, token).
			Expect()

		response.Status(http.StatusNotFound)
		response.JSON().Path("$.error").String().Equal("failed to retrieve link: record does not exist")
	})
}
