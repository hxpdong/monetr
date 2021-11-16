import React, { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import useBootstrapLogin from 'shared/authentication/actions/bootstrapLogin';
import useSignUp, { SignUpResponse } from 'shared/authentication/actions/signUp';
import {
  getInitialPlan,
  getReCAPTCHAKey,
  getRequireBetaCode,
  getShouldVerifyRegister,
} from 'shared/bootstrap/selectors';
import classnames from 'classnames';
import {
  Alert,
  AlertTitle,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormGroup,
  Snackbar,
  TextField
} from '@mui/material';
import { Formik, FormikHelpers } from 'formik';
import verifyEmailAddress from 'util/verifyEmailAddress';
import AfterEmailVerificationSent from 'views/Authentication/AfterEmailVerificationSent';
import CaptchaMaybe from 'views/Captcha/CaptchaMaybe';

import Logo from 'assets';

interface SignUpValues {
  agree: boolean;
  betaCode: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  verifyPassword: string;
}

const SignUpView = (): JSX.Element => {
  const [error, setError] = useState<string | null>(null);

  function hideError() {
    setError(null);
  }

  function renderErrorMaybe(): JSX.Element | null {
    if (!error) {
      return null;
    }

    return (
      <Snackbar open={ !!error } autoHideDuration={ 10000 } onClose={ hideError }>
        <Alert variant="filled" severity="error">
          <AlertTitle>Error</AlertTitle>
          { error }
        </Alert>
      </Snackbar>
    )
  }

  const [successful, setSuccessful] = useState(false);

  const requireBetaCode = useSelector(getRequireBetaCode);

  function validateInput(values: SignUpValues): Partial<SignUpValues> {
    let errors: Partial<SignUpValues> = {};

    if (values.email) {
      if (!verifyEmailAddress(values.email)) {
        errors['email'] = 'Please provide a valid email address.';
      }
    }

    if (values.password) {
      if (values.password.length < 8) {
        errors['password'] = 'Password must be at least 8 characters long.';
      }
    }

    if (values.verifyPassword && values.password !== values.verifyPassword) {
      errors['verifyPassword'] = 'Passwords must match.';
    }

    if (values.firstName && values.firstName.length === 0) {
      errors['firstName'] = 'First name is required.';
    }

    if (values.lastName && values.lastName.length === 0) {
      errors['lastName'] = 'Last name is required.';
    }

    if (requireBetaCode && !values.betaCode) {
      errors['betaCode'] = 'Beta code is required.';
    }

    return errors;
  }

  const initialPlan = useSelector(getInitialPlan);
  const verifyRegister = useSelector(getShouldVerifyRegister);

  const [verification, setVerification] = useState<string | null>(null);

  function cannotSubmit(values: SignUpValues): boolean {
    const verified = !verifyRegister || verification;
    return !(verified &&
      values.email &&
      values.password &&
      values.firstName &&
      values.lastName &&
      values.agree
    );
  }

  function renderSignUpText(isSubmitting: boolean): JSX.Element | string {
    if (isSubmitting) {
      return 'Signing up...';
    }

    if (initialPlan) {
      const suffix = initialPlan.freeTrialDays > 0 ? <span>(Free for { initialPlan.freeTrialDays } days)</span> : '';

      return (
        <Fragment>
          <span className="mr-1">Sign Up For</span>
          <span className="mr-1"> ${ (initialPlan.price / 100).toFixed(2) }</span>
          { suffix }
        </Fragment>
      );
    }

    return 'Sign Up';
  }

  const signUp = useSignUp();
  const bootstrapLogin = useBootstrapLogin();
  const navigate = useNavigate();

  function submit(values: SignUpValues, { setSubmitting }: FormikHelpers<SignUpValues>): Promise<void> {
    setSubmitting(true);
    return signUp({
      agree: values.agree,
      betaCode: values.betaCode,
      captcha: verification,
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName,
      password: values.password,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
      .then((result: SignUpResponse) => {
        // After sending the sign up request, if the user needs to verify their email then the requires verification
        // field will be true. We can stop here and just show the user a successful screen.
        if (result.requireVerification) {
          return setSuccessful(true);
        }

        return bootstrapLogin(result.user, result.isActive)
          .then(() => {
            if (result.nextUrl) {
              return navigate(result.nextUrl);
            }

            return navigate('/');
          });
      })
      .catch(error => {
        setError(error?.response?.data?.error || 'Failed to sign up.');

        throw error;
      })
      .finally(() => {
        setVerification(null);
        setSubmitting(false);
      });
  }

  const initialValues: SignUpValues = {
    agree: false,
    betaCode: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    verifyPassword: '',
  };

  if (successful) {
    return <AfterEmailVerificationSent/>
  }

  return (
    <Fragment>
      { renderErrorMaybe() }
      <Formik
        initialValues={ initialValues }
        validate={ validateInput }
        onSubmit={ submit }
      >
        { ({
             values,
             errors,
             touched,
             handleChange,
             handleBlur,
             handleSubmit,
             isSubmitting,
             submitForm,
           }) => (
          <form onSubmit={ handleSubmit } className="h-full overflow-y-auto">
            <div className="flex justify-center w-full h-full max-h-full">
              <div className="w-full p-10 max-w-screen-sm sm:p-0">
                <div className="flex justify-center w-full mt-5 mb-5">
                  <img src={ Logo } className="w-1/4"/>
                </div>
                <div className="w-full">
                  <div className="w-full pb-1.5 pt-1.5">
                    <TextField
                      autoFocus
                      className="w-full"
                      disabled={ isSubmitting }
                      error={ touched.email && !!errors.email }
                      helperText={ (touched.email && errors.email) ? errors.email : null }
                      id="login-email"
                      label="Email"
                      name="email"
                      onBlur={ handleBlur }
                      onChange={ handleChange }
                      value={ values.email }
                      variant="outlined"
                      autoComplete="username"
                    />
                  </div>
                  <div className="w-full pb-1.5 pt-1.5 grid grid-flow-row gap-2 sm:grid-flow-col">
                    <TextField
                      className="w-full"
                      disabled={ isSubmitting }
                      error={ touched.firstName && !!errors.firstName }
                      helperText={ (touched.firstName && errors.firstName) ? errors.firstName : null }
                      id="login-firstName"
                      label="First Name"
                      name="firstName"
                      onBlur={ handleBlur }
                      onChange={ handleChange }
                      value={ values.firstName }
                      variant="outlined"
                    />
                    <TextField
                      className="w-full"
                      disabled={ isSubmitting }
                      error={ touched.lastName && !!errors.lastName }
                      helperText={ (touched.lastName && errors.lastName) ? errors.lastName : null }
                      id="login-lastName"
                      label="Last Name"
                      name="lastName"
                      onBlur={ handleBlur }
                      onChange={ handleChange }
                      value={ values.lastName }
                      variant="outlined"
                    />
                  </div>
                  <div className="w-full pb-1.5 pt-1.5 grid grid-flow-row gap-2 sm:grid-flow-col">
                    <TextField
                      className="w-full"
                      disabled={ isSubmitting }
                      error={ touched.password && !!errors.password }
                      helperText={ (touched.password && errors.password) ? errors.password : null }
                      id="login-password"
                      label="Password"
                      name="password"
                      onBlur={ handleBlur }
                      onChange={ handleChange }
                      type="password"
                      value={ values.password }
                      variant="outlined"
                      autoComplete="new-password"
                    />
                    <TextField
                      className="w-full"
                      disabled={ isSubmitting }
                      error={ touched.verifyPassword && !!errors.verifyPassword }
                      helperText={ (touched.verifyPassword && errors.verifyPassword) ? errors.verifyPassword : null }
                      id="login-verifyPassword"
                      label="Verify Password"
                      name="verifyPassword"
                      onBlur={ handleBlur }
                      onChange={ handleChange }
                      type="password"
                      value={ values.verifyPassword }
                      variant="outlined"
                      autoComplete="new-password"
                    />
                  </div>
                  { requireBetaCode &&
                  <div className="w-full pt-1.5 pb-1.5">
                    <TextField
                      className="w-full"
                      disabled={ isSubmitting }
                      error={ touched.betaCode && !!errors.betaCode }
                      helperText={ (touched.betaCode && errors.betaCode) ? errors.betaCode : null }
                      id="login-betaCode"
                      label="Beta Code"
                      name="betaCode"
                      onBlur={ handleBlur }
                      onChange={ handleChange }
                      type="betaCode"
                      value={ values.betaCode }
                      variant="outlined"
                    />
                  </div>
                  }
                </div>
                <CaptchaMaybe onVerify={ setVerification } show={ verifyRegister }/>
                <div className="w-full flex justify-center items-center pt-1.5 pb-1">
                  <FormControl component="fieldset">
                    <FormGroup aria-label="position" row>
                      <FormControlLabel
                        control={
                          <Checkbox
                            color="primary"
                            name="agree"
                            onChange={ handleChange }
                          />
                        }
                        label="I agree to stuff and things"
                        labelPlacement="end"
                        value="end"
                      />
                    </FormGroup>
                  </FormControl>
                </div>
                <div className="w-full pt-1.5 flex justify-center pb-10">
                  <Button
                    className="w-1/2 mr-1 min-w-max"
                    color="secondary"
                    disabled={ isSubmitting }
                    onClick={ () => navigate('/login') }
                    variant="outlined"
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-1/2 ml-1 min-w-max"
                    color="primary"
                    disabled={ isSubmitting || cannotSubmit(values) }
                    onClick={ submitForm }
                    type="submit"
                    variant="contained"
                  >
                    { isSubmitting && <CircularProgress
                      className={ classnames('mr-2', {
                        'opacity-50': isSubmitting,
                      }) }
                      size="1em"
                      thickness={ 5 }
                    /> }
                    { renderSignUpText(isSubmitting) }
                  </Button>
                </div>
              </div>
            </div>
          </form>
        ) }
      </Formik>
    </Fragment>
  )
};

export default SignUpView;